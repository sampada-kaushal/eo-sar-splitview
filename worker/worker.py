#!/usr/bin/env python3
import argparse, os, json, sys
import numpy as np
import rasterio
from rasterio.windows import from_bounds
from rasterio import warp as rio_warp
from skimage.registration import phase_cross_correlation

def parse_aoi(aoi_str: str):
    parts = dict(p.split('=') for p in aoi_str.split(';'))
    return {k: float(v) for k, v in parts.items()}

def read_window_by_bounds(ds: rasterio.io.DatasetReader, aoi4326):
    # Transform AOI (EPSG:4326) to dataset CRS
    left, bottom, right, top = rio_warp.transform_bounds('EPSG:4326', ds.crs, aoi4326['west'], aoi4326['south'], aoi4326['east'], aoi4326['north'])
    window = from_bounds(left, bottom, right, top, transform=ds.transform)
    data = ds.read(1, window=window, out_dtype='float32', resampling=rasterio.enums.Resampling.bilinear)
    transform = ds.window_transform(window)
    profile = ds.profile.copy()
    profile.update({'height': data.shape[0], 'width': data.shape[1], 'transform': transform, 'count': 1, 'dtype': 'float32', 'compress': 'lzw'})
    return data, profile

def write_tif(path, data, profile):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with rasterio.open(path, 'w', **profile) as dst:
        dst.write(data, 1)

def align_translation(ref_data, ref_prof, mov_data, mov_prof):
    if ref_data.size == 0 or mov_data.size == 0:
        raise RuntimeError("Empty AOI window")
    # Estimate subpixel shift (dy, dx)
    shift, error, diffphase = phase_cross_correlation(ref_data, mov_data, upsample_factor=10)
    dy, dx = shift  # rows, cols (y, x)
    # Apply pixel translation to moving transform
    moved_transform = mov_prof['transform'] * rasterio.Affine.translation(dx, dy)
    # Reproject moving image into ref grid
    dst = np.zeros_like(ref_data, dtype='float32')
    rio_warp.reproject(
        source=mov_data,
        destination=dst,
        src_transform=moved_transform,
        src_crs=mov_prof['crs'],
        dst_transform=ref_prof['transform'],
        dst_crs=ref_prof['crs'],
        resampling=rio_warp.Resampling.bilinear,
    )
    return dst, ref_prof

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--image_a', required=True)
    ap.add_argument('--image_b', required=True)
    ap.add_argument('--aoi', required=True)
    ap.add_argument('--out_dir', required=True)
    args = ap.parse_args()
    print("*****")
    print(args)
    print(args.aoi)
    aoi = parse_aoi(args.aoi)
    try:
        with rasterio.open(args.image_a) as da, rasterio.open(args.image_b) as db:
            a_data, a_prof = read_window_by_bounds(da, aoi)
            b_data, b_prof = read_window_by_bounds(db, aoi)
            b_aligned, b_aligned_prof = align_translation(a_data, a_prof, b_data, b_prof)

            outA = os.path.join(args.out_dir, 'A_clipped.tif')
            outB = os.path.join(args.out_dir, 'B_clipped_aligned.tif')
            write_tif(outA, a_data, a_prof)
            write_tif(outB, b_aligned, b_aligned_prof)

        print(json.dumps({'ok': True, 'outputs': {'A': outA, 'B': outB}}))
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}))
        sys.stderr.write(str(e))
        sys.exit(2)

if __name__ == '__main__':
    main()
