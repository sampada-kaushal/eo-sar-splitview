import React from "react";
export default function Progress({ status }){
  const color = status==="DONE" ? "#16a34a" : status==="RUNNING" ? "#2563eb" : status==="ERROR" ? "#dc2626" : "#a3a3a3";
  return <span className="chip" style={{ background: color }}>{status}</span>;
}
