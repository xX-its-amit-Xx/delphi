import zipfile,re,sys
import xml.etree.ElementTree as ET
NS={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def col(c):
    n=0
    for ch in re.match(r'[A-Z]+',c).group(): n=n*26+ord(ch)-64
    return n-1
def read(path):
    z=zipfile.ZipFile(path)
    ss=[]
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si',NS):
            ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%NS['m'])))
    wb=ET.fromstring(z.read('xl/workbook.xml'))
    rels={r.get('Id'):r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    out={}
    for s in wb.find('m:sheets',NS):
        tgt=rels[s.get('{%s}id'%NS['r'])]; tgt=tgt.lstrip('/'); 
        if not tgt.startswith('xl/'): tgt='xl/'+tgt
        rows=[]
        for row in ET.fromstring(z.read(tgt)).iter('{%s}row'%NS['m']):
            r=[]
            for c in row.findall('m:c',NS):
                i=col(c.get('r')); v=c.find('m:v',NS); t=c.get('t')
                val=None
                if v is not None:
                    val=ss[int(v.text)] if t=='s' else v.text
                    if t!='s':
                        try: val=float(val)
                        except: pass
                elif t=='inlineStr': val=''.join(x.text or '' for x in c.iter('{%s}t'%NS['m']))
                while len(r)<=i: r.append(None)
                r[i]=val
            rows.append(r)
        out[s.get('name')]=rows
    return out
if __name__=="__main__":
    for p in sys.argv[1:]:
        d=read(p); print("=====",p)
        for k,rows in d.items():
            print("  --",k,len(rows),"rows, maxcols",max((len(r) for r in rows),default=0))
            for r in rows[:4]: print("     ",[ (x if not isinstance(x,str) else x[:28]) for x in r[:14]])
