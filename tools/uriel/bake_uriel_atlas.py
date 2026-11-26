import base64, io, json, re, subprocess, sys
from pathlib import Path
import fitz
from PIL import Image

root=Path(sys.argv[1])
source=Path(__file__).parent
asset=root/'src/client/assets/heroes'
cache={}
def data_png(m):
 k=m[1]
 if k not in cache:
  a=Image.open(io.BytesIO(base64.b64decode(k)))
  f=io.BytesIO();a.save(f,'PNG')
  cache[k]='data:image/png;base64,'+base64.b64encode(f.getvalue()).decode()
 return cache[k]
def frame(svg):
 svg=svg[:svg.index('<g id="stage">')]+svg[svg.index('<g id="character"'):]
 svg=svg.replace('transform="translate(54 88)"','',1)
 svg=svg.replace('width="1160" height="750" viewBox="0 0 1160 750"','width="416" height="270" viewBox="-37 -187 1124 730"',1)
 svg=re.sub(r'data:image/webp;base64,([a-zA-Z0-9+/=]+)',data_png,svg)
 with fitz.open(stream=svg.encode(),filetype='svg') as doc:
  pix=doc[0].get_pixmap(alpha=True)
 # Convert MuPDF premultiplied colors to ordinary straight alpha.
 return Image.frombytes('RGBa',[pix.width,pix.height],pix.samples).convert('RGBA')
width,height=256,166
sheet=Image.new('RGBA',(width*8,height*9))
process=subprocess.Popen(['node',str(source/'capture-battle.mjs'),'battle'],stdout=subprocess.PIPE,encoding='utf-8')
n=0
for line in process.stdout:
 im=frame(json.loads(line))
 assert im.size==(416,270),im.size
 bbox=im.getchannel('A').point(lambda value:255 if value>60 else 0).getbbox()
 assert bbox and bbox[0]>0 and bbox[1]>0 and bbox[2]<416 and bbox[3]<270,(n,bbox)
 im=im.resize((width,height),Image.Resampling.LANCZOS)
 if n==0: im.save(asset/'archangels/uriel-motion-still.webp','WEBP',quality=94,method=6,exact=True)
 sheet.paste(im,((n%8)*width,(n//8)*height))

 n+=1
assert process.wait()==0 and n==72
target=asset/'archangels/uriel-motion-atlas.webp'
sheet.save(target,'WEBP',quality=91,method=6,exact=True)
with Image.open(target) as check:
 assert check.size==(width*8,height*9) and check.mode=='RGBA'
print('Uriel motion atlas',n,sheet.size,target.stat().st_size)
