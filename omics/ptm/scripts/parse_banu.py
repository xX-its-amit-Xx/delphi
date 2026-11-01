import zipfile, re, json, sys
def rows(fn):
    x = zipfile.ZipFile(fn).read('word/document.xml').decode('utf-8')
    out = []
    for tr in re.findall(r'<w:tr[ >].*?</w:tr>', x, re.S):
        cells = [re.sub(r'<[^>]+>', '', c).strip() for c in re.findall(r'<w:tc>.*?</w:tc>', tr, re.S)]
        out.append(cells)
    return out
r1 = rows(sys.argv[1]); r2 = rows(sys.argv[2])
json.dump({'t1': r1, 't2': r2}, open(sys.argv[3], 'w'))
print(len(r1), r1[:3], len(r2), r2[:5], r2[-2:])
