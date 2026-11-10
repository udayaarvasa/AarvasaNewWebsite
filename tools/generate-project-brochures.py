"""Build Aarvasa project PDFs from an exported catalog. Requires reportlab and Pillow.

Usage: python generate-project-brochures.py CATALOG_JSON SOURCE_MAP_JSON PUBLIC_DIR FONT_DIR
Regenerate after changing project specifications, pricing or imagery.
"""
import sys,json,io
from pathlib import Path
from html import escape
from PIL import Image as PILImage,ImageOps
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Table,TableStyle,Image,KeepTogether
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor,white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.enums import TA_LEFT

catalog,sources,public,fontdir=sys.argv[1:]
public=Path(public);out=public/'brochures';out.mkdir(exist_ok=True)
fontdir=Path(fontdir)
for name,file in [('AV','DejaVuSans.ttf'),('AVBold','DejaVuSans-Bold.ttf')]:pdfmetrics.registerFont(TTFont(name,str(fontdir/file)))
INK=HexColor('#24342e');GOLD=HexColor('#92733e');MUTED=HexColor('#5f6962');CREAM=HexColor('#f8f5ed');RULE=HexColor('#ddd7c9')
styles={
 'body':ParagraphStyle('body',fontName='AV',fontSize=9.3,leading=14,textColor=INK,spaceAfter=8),
 'small':ParagraphStyle('small',fontName='AV',fontSize=7.4,leading=11,textColor=MUTED,spaceAfter=7),
 'title':ParagraphStyle('title',fontName='AVBold',fontSize=29,leading=35,textColor=INK,spaceAfter=10),
 'h1':ParagraphStyle('h1',fontName='AVBold',fontSize=23,leading=29,textColor=INK,spaceAfter=15),
 'h2':ParagraphStyle('h2',fontName='AVBold',fontSize=12,leading=17,textColor=GOLD,spaceBefore=12,spaceAfter=8),
 'price':ParagraphStyle('price',fontName='AVBold',fontSize=18,leading=24,textColor=GOLD,spaceAfter=14),
}
def P(text,kind='body'):
 text=str(text or '').replace('\u2011','-').replace('—','-').replace('–','-')
 return Paragraph(escape(text).replace('\n','<br/>'),styles[kind])
def link(text,url):return Paragraph(f'<link href="{escape(url,quote=True)}" color="#92733e"><u>{escape(text)}</u></link>',styles['body'])
def money(n,c):return f'{"₹" if c=="INR" else "AED "}{n:,.0f}' if n else 'On request'
def image(src,w,h,contain=False):
 im=ImageOps.exif_transpose(PILImage.open(public/src.lstrip('/'))).convert('RGB')
 if contain:
  im.thumbnail((int(w*2),int(h*2)));ratio=min(w/im.width,h/im.height);iw,ih=im.width*ratio,im.height*ratio
 else:im=ImageOps.fit(im,(int(w*2),int(h*2)),method=PILImage.Resampling.LANCZOS);iw,ih=w,h
 b=io.BytesIO();im.save(b,format='JPEG',quality=88,optimize=True);b.seek(0)
 return Image(b,width=iw,height=ih)
def table(rows,widths,header=False):
 data=[[P(cell,'small') for cell in row] for row in rows]
 t=Table(data,colWidths=widths,hAlign='LEFT',repeatRows=1 if header else 0)
 t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),9),('RIGHTPADDING',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),8),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,0),(-1,-1),.5,RULE),('BACKGROUND',(0,0),(-1,0),HexColor('#ebe5d6') if header else CREAM)]))
 return t
sources=json.load(open(sources));manifest={}
for p in json.load(open(catalog)):
 slug=p['slug'];name=p['name'];source=sources[slug];c=p['currency'];story=[]
 def add(*items):story.extend(items)
 add(P('AARVASA  /  PROPERTY BROCHURE','h2'),Spacer(1,6))
 if p.get('hero'):add(image(p['hero'],499,281),Spacer(1,7),P('Bhopal city photograph' if p.get('imagery',{}).get('hero',{}).get('origin')=='area' else 'Developer architectural render','small'))
 add(P(name,'title'),P(p['location']+', '+p['city'],'body'))
 price=money(p['fromPrice'],c) if p['fromPrice'] else money(p['ratePerSqft'],c)+'/sq.ft' if p['ratePerSqft'] else 'Price on request'
 add(P(('Starting from ' if p['fromPrice'] else 'Quoted rate ' if p['ratePerSqft'] else '')+price,'price'))
 overview=p.get('seo',{}).get('intro',p.get('seo',{}).get('description',''))
 if isinstance(overview,list):overview='\n'.join(overview)
 add(P(overview),P('Aarvasa project guide | 10 November 2026','small'),PageBreak())
 add(P('Specification & pricing','h1'))
 facts=[['Developer',p['developer']],['Location',p['location']+', '+p['city']],['Property type','Residential plots' if p['kind']=='plots' else 'Residences'],['Completion',p['completion'] or 'Confirm with Aarvasa'],['Total plots' if p['kind']=='plots' else 'Total residences',str(p['totalUnits']) if p['totalUnits'] is not None else 'Not published'],['Building configuration',p['buildingConfig'] or 'Not applicable' if p['kind']=='plots' else p['buildingConfig'] or 'Not published']]
 if p['minSqft']:facts.append(['Published size range',f"{p['minSqft']:,.0f} - {p['maxSqft']:,.0f} sq.ft"])
 if p['ratePerSqft']:facts.append(['Quoted plot rate',money(p['ratePerSqft'],c)+'/sq.ft'])
 add(table(facts,[160,339]),Spacer(1,8))
 if p['unitTypes']:
  add(P('Configurations','h2'),table([['Configuration','Area (sq.ft)','From'],*[[u['label'],f"{u['minSqft']:,.0f} - {u['maxSqft']:,.0f}" if u['minSqft']!=u['maxSqft'] else f"{u['minSqft']:,.0f}",money(u['fromPrice'],c)] for u in p['unitTypes']]],[185,135,179],True))
 if p['rateNote']:add(P(p['rateNote']))
 if p['paymentPlans']:
  add(P('Payment options','h2'),table([['Plan','Booking','During construction','Final'],*[[r['name'],r['downPayment'],r['duringConstruction'],r['final']+((' / '+r['note']) if r['note'] else '')] for r in p['paymentPlans']]],[150,70,115,164],True))
 else:add(P('Payment terms','h2'),P('Ask Aarvasa for the current payment schedule for your selected plot or residence.'))
 add(Spacer(1,10),P('Prices and availability reflect the website catalog and can change. Confirm the selected unit, final price and purchase charges before booking.','small'),PageBreak())
 add(P('Lifestyle & location','h1'))
 gallery=p.get('gallery',[])
 if len(gallery)>=2:
  add(Table([[image(gallery[0]['src'],243,162),image(gallery[1]['src'],243,162)]],colWidths=[249.5,249.5],style=[('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0)]),Spacer(1,8))
 add(P('Highlights','h2'))
 for item in p['usps']:add(P('• '+item))
 if p['approvals']:add(P('Listed approvals','h2'),P('\n'.join(p['approvals'])))
 if p['nearby']:
  add(P('Nearby landmarks','h2'),table([[r['place'],f"{r['minutes']} min" if r['minutes'] else 'Nearby'] for r in p['nearby']],[350,149]))
 else:add(P('Explore the location','h2'),P(p['location']+', '+p['city']+'. Contact Aarvasa to arrange a site visit and confirm access.'))
 if p.get('imagery',{}).get('hero',{}).get('origin')=='area':
  add(P('Images show Bhopal city landmarks, not the development. Upper Lake: Bilal Nibraas. Airport: Doctorchickencolslw. Wikimedia Commons / CC BY-SA 4.0; cropped.','small'))
  for credit in p['imagery'].get('attribution',[]):add(link(credit['text'],credit['href']))
 else:add(P('Images are developer architectural renders of the proposed design.','small'))
 add(PageBreak(),P('Plans & enquiries','h1'))
 if p['planImages']:
  add(image(p['planImages'][0],499,350,True),Spacer(1,6),P('Developer layout drawing. Open the source document to inspect the full-size plan.','small'))
 elif len(gallery)>2:
  add(image(gallery[2]['src'],499,240),Spacer(1,8))
 add(P('Developer document','h2'),link('Open the developer brochure / layout PDF',source),P('Use the original developer document for the full specification and available floor-plan drawings. Confirm the edition and current details with Aarvasa.','small'))
 add(P('Speak to Aarvasa','h2'),P('Arrange a site visit, request a current quote or ask about a specific layout.'),P('+91 63820 83873  |  contact@aarvasa.com'),link('View this property and enquire','https://www.aarvasa.com/projects/'+slug))
 def page(canvas,doc):
  canvas.saveState();canvas.setFillColor(CREAM);canvas.rect(0,0,595.28,841.89,fill=1,stroke=0);canvas.setStrokeColor(RULE);canvas.line(48,38,547,38);canvas.setFont('AV',7);canvas.setFillColor(MUTED);canvas.drawString(48,25,'AARVASA  /  '+name);canvas.drawRightString(547,25,str(doc.page));canvas.restoreState()
 dest=out/(slug+'.pdf');doc=SimpleDocTemplate(str(dest),pagesize=(595.28,841.89),rightMargin=48,leftMargin=48,topMargin=42,bottomMargin=52,title=name+' | Aarvasa property brochure',author='Aarvasa Innovations Pvt. Ltd.')
 doc.build(story,onFirstPage=page,onLaterPages=page)
 from pypdf import PdfReader
 manifest[slug]={'href':'/brochures/'+dest.name,'pages':len(PdfReader(dest).pages),'bytes':dest.stat().st_size,'sourceHref':source}
 print(name,manifest[slug]['pages'],'pages')
(out/'manifest.json').write_text(json.dumps(manifest,indent=2))
