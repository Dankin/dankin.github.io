#!/bin/bash
# 顺序批跑（宿主机负载高时不要并行起多个浏览器）
cd "$(dirname "$0")"
export QA_URL=http://127.0.0.1:5189
for d in desktop desktop-hd iphone android portrait; do echo "### flow $d $(date +%T)"; node 02-flow.mjs $d 2>&1 | tail -40; done
echo "### flow subpath desktop $(date +%T)"; QA_URL=http://127.0.0.1:5190/sub/path node 02-flow.mjs desktop 2>&1 | tail -30
echo "### audio $(date +%T)"; node 05-audio.mjs 2>&1 | tail -15
echo "### soak desktop $(date +%T)"; SOAK_MIN=10 node 03-perf-mem.mjs desktop 2>&1 | cut -c1-600 | tail -30
echo "### soak iphone $(date +%T)"; SOAK_MIN=4 node 03-perf-mem.mjs iphone 2>&1 | cut -c1-600 | tail -30
echo "### DONE $(date +%T)"
