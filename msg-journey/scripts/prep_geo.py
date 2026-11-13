"""Preprocess Natural Earth + TeleGeography GeoJSON into compact arrays for the globe scene."""
import json, math
def load(p): return json.load(open(p))
OUT = {}
# --- coastlines: list of [lon,lat,...] flat arrays, lightly decimated
coast = load('public/data/ne_50m_coastline.geojson')
lines = []
for f in coast['features']:
    g = f['geometry']; parts = g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
    for ln in parts:
        pts = ln[::2] + ([ln[-1]] if len(ln)%2==0 else [])
        if len(pts) >= 2: lines.append([round(c,2) for p in pts for c in p])
OUT['coast'] = lines
# --- cables: all cables as flat polylines (for the dim network), plus highlighted transpacific routes
cab = load('public/data/cable-geo.json')
allc = []
by_name = {}
for f in cab['features']:
    g = f['geometry']; parts = g['coordinates'] if g['type']=='MultiLineString' else [g['coordinates']]
    nm = f['properties']['name']
    for ln in parts:
        if len(ln) >= 2: allc.append([round(c,2) for p in ln for c in p])
        by_name.setdefault(nm, []).append(ln)
OUT['cables'] = allc
def unwrap(ln):
    out=[]; prev=None
    for lon,lat in ln:
        if prev is not None:
            while lon-prev>180: lon-=360
            while lon-prev<-180: lon+=360
        out.append([lon,lat]); prev=lon
    return out
def span(ln):
    u=unwrap(ln); return abs(u[-1][0]-u[0][0])
picked = {}
def L(lon): return lon+360 if lon<0 else lon
def key(p): return (round(L(p[0])%360,1), round(p[1],1))
import collections
for name, dest in [('New Cross Pacific (NCP) Cable System','us'),('Trans-Pacific Express (TPE) Cable System','us'),('FASTER','us'),('Pacific Light Cable Network (PLCN)','us'),('Tata TGN-Pacific','us'),('Pacific Crossing-1 (PC-1)','us')]:
    segs = [[[L(lon),lat] for lon,lat in ln] for ln in by_name[name]]
    adj = collections.defaultdict(list)
    for i,sg in enumerate(segs):
        a,b = key(sg[0]), key(sg[-1])
        # treat 0/360 seam as same
        adj[a].append((b,i,False)); adj[b].append((a,i,True))
    def norm(k): return (k[0]%360, k[1])
    # merge seam keys 360.0 and 0.0 and 180 duplicates
    keys=list(adj.keys())
    starts=[k for k in keys if 95<k[0]<150]; goals=[k for k in keys if 230<k[0]<250]
    best=None
    for s0 in starts:
        prev={s0:None}; q=collections.deque([s0])
        while q:
            k=q.popleft()
            for nb,i,rev in adj[k]:
                if nb not in prev: prev[nb]=(k,i,rev); q.append(nb)
        for g in goals:
            if g in prev:
                path=[]; k=g
                while prev[k] is not None:
                    pk,i,rev=prev[k]; path.append((i,rev)); k=pk
                path=path[::-1]
                pts=[]
                for i,rev in path:
                    sg=segs[i][::-1] if rev else segs[i]
                    pts += sg if not pts else sg[1:]
                ln=sum(math.dist(pts[j],pts[j+1]) for j in range(len(pts)-1))
                if best is None or ln<best[0]: best=(ln,pts)
    if best is None: print('NO PATH', name); continue
    pts=best[1]
    picked[name]={'pts':[[round(p[0],3),round(p[1],3)] for p in pts]}
    print(name, len(pts), pts[0], pts[-1])
OUT['routes'] = picked
json.dump(OUT, open('public/data/globe.json','w'), separators=(',',':'))
import os; print('size', os.path.getsize('public/data/globe.json'))
