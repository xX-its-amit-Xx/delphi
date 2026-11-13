import sys,re,html
src,dst=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8',errors='replace').read()
# prefer alttext of math
s=re.sub(r'<math[^>]*alttext="([^"]*)"[^>]*>.*?</math>',lambda m:' $'+html.unescape(m.group(1))+'$ ',s,flags=re.S)
s=re.sub(r'<(script|style)[^>]*>.*?</\1>','',s,flags=re.S)
s=re.sub(r'</(p|div|h\d|li|tr|figcaption|section|table)>','\n',s)
s=re.sub(r'<[^>]+>','',s)
s=html.unescape(s)
s=re.sub(r'[ \t]+',' ',s); s=re.sub(r'\n\s*\n+','\n',s)
open(dst,'w',encoding='utf-8').write(s)
print(len(s))
