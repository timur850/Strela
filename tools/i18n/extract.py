import re, json, sys
CYR = re.compile('[А-Яа-яЁё]')
def js_strings(src):
    """yield list of pieces for each string literal: [('t',text),('p',expr),...]"""
    i, n = 0, len(src)
    out = []
    def read_template(i):
        # src[i] == '`'
        pieces=[]; buf=''; i+=1
        while i<n:
            c=src[i]
            if c=='\\': buf+=src[i:i+2]; i+=2; continue
            if c=='`': pieces.append(('t',buf)); return pieces,i+1
            if c=='$' and i+1<n and src[i+1]=='{':
                pieces.append(('t',buf)); buf=''
                j=i+2; depth=1; start=j
                while j<n and depth:
                    ch=src[j]
                    if ch in '\'"':
                        q=ch; j+=1
                        while j<n and src[j]!=q:
                            j+= 2 if src[j]=='\\' else 1
                        j+=1; continue
                    if ch=='`':
                        sub,j2=read_template(j); out.append(sub); j=j2; continue
                    if ch=='{': depth+=1
                    elif ch=='}': depth-=1
                    j+=1
                pieces.append(('p',src[start:j-1])); out.extend(js_strings(src[start:j-1])); i=j; continue
            buf+=c; i+=1
        return pieces,i
    while i<n:
        c=src[i]
        if c=='/' and i+1<n and src[i+1]=='/':
            j=src.find('\n',i); i = n if j<0 else j; continue
        if c=='/' and i+1<n and src[i+1]=='*':
            j=src.find('*/',i+2); i = n if j<0 else j+2; continue
        if c in '\'"':
            q=c; j=i+1; buf=''
            while j<n and src[j]!=q and src[j]!='\n':
                if src[j]=='\\': buf+=src[j:j+2]; j+=2; continue
                buf+=src[j]; j+=1
            out.append([('t',buf)]); i=j+1; continue
        if c=='`':
            p,i=read_template(i); out.append(p); continue
        i+=1
    return out
TAG=re.compile(r'''<[a-zA-Z/!][^<>"']*(?:"[^"]*"[^<>"']*|'[^']*'[^<>"']*)*>''')
ONA=re.compile(r'''\bon\w+="([^"]*)"''')
ATTR=re.compile(r'\b(?:placeholder|title|aria-label)="([^"]*)"')
def segments(pieces):
    s=''; ph=0
    for k,v in pieces:
        if k=='t': s+=v
        else: s+='\x00%d\x00'%ph; ph+=1
    res=[]
    for m in ATTR.finditer(s):
        if CYR.search(m.group(1)): res.append(m.group(1))
    for m in ONA.finditer(s):
        if CYR.search(m.group(1)):
            for pcs in js_strings(m.group(1).replace('\x00','')):
                pass
            for pcs in js_strings(m.group(1)):
                res.extend(segments(pcs))
    for seg in TAG.split(s):
        seg=seg.replace('\\n',' ').strip()
        if CYR.search(seg): res.append(seg)
    return res
def norm(seg):
    # placeholders -> {0},{1}.. in order
    k=[0]
    def r(m):
        x='{%d}'%k[0]; k[0]+=1; return x
    return re.sub(r'\x00\d+\x00', r, seg)
keys={}
for f in sys.argv[1:]:
    src=open(f).read()
    if f.endswith('.html'):
        # html text outside scripts
        parts=re.split(r'(<script[^>]*>.*?</script>|<style[^>]*>.*?</style>)', src, flags=re.S)
        for p in parts:
            if p.startswith('<script'):
                for pcs in js_strings(p):
                    for sg in segments(pcs): keys.setdefault(norm(sg),f)
            elif not p.startswith('<style'):
                for sg in segments([('t',p)]): keys.setdefault(norm(sg),f)
    else:
        for pcs in js_strings(src):
            for sg in segments(pcs): keys.setdefault(norm(sg),f)
# also fragments: split patterns at placeholders
frags={}
for k in list(keys):
    if '{' in k:
        for fr in re.split(r'\{\d+\}',k):
            fr=fr.strip(' ·,:—-()')
            if CYR.search(fr) and fr not in keys: frags[fr]=1
print(len(keys), len(frags), file=sys.stderr)
json.dump({'keys':sorted(keys), 'frags':sorted(frags)}, open(sys.stdout.fileno(),'w'), ensure_ascii=False, indent=0)
