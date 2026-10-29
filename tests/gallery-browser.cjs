'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(__dirname+'/../public/assets/catalog-api.js','utf8');
const snippet=source.slice(source.indexOf('showProduct=function'),source.indexOf('updateList=function'));
let checks=0;const check=(value,label)=>{assert(value,label);checks++;};
function element(){return {children:[],attrs:{},hidden:false,append(...nodes){this.children.push(...nodes);},setAttribute(k,v){this.attrs[k]=v;}};}
function gallery(extra){const nodes=Object.fromEntries(['#productDetails','#galleryImage','#galleryStatus','#galleryThumbnails','#galleryPrevious','#galleryNext','.gallery-controls','.pack-gallery','#productDialog'].map(k=>[k,element()]));const p={id:'pack',name:'Test pack',new:true,copy:'Product copy',origin:'Test origin',variants:[],gallery:extra};const context={find:()=>p,images:{pack:'assets/front.webp'},escapeHTML:v=>String(v??'').replaceAll('<','&lt;'),$:s=>nodes[s]||null,document:{createElement:element},openDialog:()=>{},storeConnected:true};vm.createContext(context);vm.runInContext(snippet,context);context.showProduct('pack');return nodes;}
let n=gallery([]);check(n['.gallery-controls'].hidden,'single photo hides arrows');check(n['#galleryThumbnails'].hidden,'single photo hides thumbnails');check(n['#galleryImage'].src==='assets/front.webp','main photo shown first');
n=gallery([{image:'assets/back.webp',alt:'Back of pack'},{image:'assets/detail.webp',alt:'Ingredients'}]);
check(!n['.gallery-controls'].hidden,'multiple photos show arrows');check(n['#galleryThumbnails'].children.length===3,'thumbnail per photo');
n['#galleryNext'].onclick();check(n['#galleryImage'].src==='assets/back.webp','next opens back photo');check(n['#galleryImage'].alt==='Back of pack','meaningful photo description');check(n['#galleryStatus'].textContent==='2 / 3','photo count');
n['#galleryNext'].onclick();n['#galleryNext'].onclick();check(n['#galleryImage'].src==='assets/front.webp','next wraps to front');
n['#galleryPrevious'].onclick();check(n['#galleryImage'].src==='assets/detail.webp','previous wraps to last');
n['#galleryThumbnails'].children[1].onclick();check(n['#galleryImage'].src==='assets/back.webp','thumbnail selects photo');check(n['#galleryThumbnails'].children[1].attrs['aria-pressed']==='true','selected thumbnail announced');
n['.pack-gallery'].onkeydown({key:'ArrowRight',preventDefault(){}});check(n['#galleryImage'].src==='assets/detail.webp','keyboard navigation');
console.log(`PASS: ${checks} product gallery browser checks`);
