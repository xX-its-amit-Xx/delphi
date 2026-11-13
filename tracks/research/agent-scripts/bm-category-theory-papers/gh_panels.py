"""Scan the binary Grasshopper file for 'name=...;E=...' material-panel strings (raw-deflate streams and plain)."""
import sys,re,zlib
b=open(sys.argv[1],'rb').read()
found=set()
def scan(data):
    for m in re.finditer(rb'name=[A-Za-z0-9_\-]+;[^\x00\r\n"<]{10,200}',data):
        found.add(m.group(0).decode('latin1'))
scan(b)
# try raw-deflate decompression at every offset that looks like a deflate stream start (brute force on chunks)
for off in range(0,len(b)-8):
    if b[off] in (0xED,0xEC,0x5D,0x63,0x4B,0x4D,0x4F,0x55) :
        try:
            d=zlib.decompressobj(-15)
            out=d.decompress(b[off:off+200000])
            if len(out)>200: scan(out)
        except Exception: pass
for f in sorted(found): print(f)
