(() => {
  const modeConfig = {
    jeepney:{label:'Jeepney',color:'#2563eb'},modern:{label:'Modern PUV',color:'#f08a24'},mybus:{label:'MyBus',color:'#f2bf2f'},
    beep:{label:'BEEP / CIBUS',color:'#95633a'},uv:{label:'UV Express',color:'#7c4dff'},bus:{label:'Provincial Bus',color:'#202632'},brt:{label:'Cebu BRT',color:'#13a8a0'}
  };
  const normalize = value => (value || '').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const exactish = (a,b) => { const x=normalize(a),y=normalize(b); return x===y || x.includes(y) || y.includes(x); };
  const colorFor = mode => modeConfig[mode]?.color || '#64748b';
  const labelFor = mode => modeConfig[mode]?.label || mode;

  const extraPlaces = [
    ['Apas',10.3338,123.9078],['IT Park',10.3292,123.9067],['Cebu IT Park',10.3292,123.9067],['Lahug',10.3232,123.8994],['JY Square',10.3250,123.8982],
    ['Escario',10.3172,123.8928],['Capitol',10.3167,123.8908],['Cebu Provincial Capitol',10.3167,123.8908],['Fuente',10.3103,123.8930],['Fuente Osmeña',10.3103,123.8930],
    ['Jones',10.3048,123.8943],['Ramos',10.3032,123.8960],['General Maxilom Ave',10.3096,123.8982],['Colon',10.2950,123.8987],['Carbon',10.2913,123.8993],
    ['Carbon Market',10.2913,123.8993],['Manalili',10.2941,123.9002],['Sanciangko',10.2934,123.8976],['Junquera',10.2994,123.8978],['E-Mall',10.2971,123.8919],
    ['Urgello',10.3010,123.8892],['Pier',10.2963,123.9122],['White Gold',10.3060,123.9130],['SM City Cebu',10.3114,123.9180],['Cebu North Bus Terminal',10.3138,123.9191],
    ['Cebu South Bus Terminal',10.2986,123.8937],['Ayala',10.3185,123.9040],['Ayala Center Cebu',10.3185,123.9040],['Cebu Business Park',10.3185,123.9040],['Mabolo',10.3228,123.9154],
    ['Panagdait',10.3312,123.9174],['Parkmall',10.3377,123.9327],['Mandaue',10.3370,123.9410],['Mandaue Public Market',10.3350,123.9490],['A.S. Fortuna',10.3448,123.9256],
    ['Banilad',10.3423,123.9112],['Gaisano Country Mall',10.3520,123.9120],['Talamban',10.3704,123.9151],['Pit-os',10.4011,123.9060],['Consolacion',10.3767,123.9573],
    ['Liloan',10.3991,123.9992],['Danao',10.5200,124.0272],['Guadalupe',10.3098,123.8787],['Banawa',10.3036,123.8795],['Labangon',10.2927,123.8813],
    ['B. Rodriguez',10.3052,123.8822],['Englis',10.2985,123.8830],['Tabo-an',10.2934,123.8912],['Pardo',10.2810,123.8620],['Basak',10.2734,123.8540],
    ['Bulacao',10.2642,123.8517],['Punta',10.2871,123.8790],['SRP',10.2818,123.8814],['SM Seaside',10.2818,123.8814],['Il Corso',10.2528,123.8814],
    ['Tabunok',10.2597,123.8465],['Talisay',10.2447,123.8494],['Minglanilla',10.2450,123.7964],['Naga',10.2089,123.7580],['Carcar',10.1060,123.6402],
    ['Mactan-Cebu International Airport',10.3075,123.9794],['MCIA',10.3075,123.9794],['Cebu Doctors University',10.3361,123.9351],['USC Downtown',10.2978,123.8980],['USJ-R',10.2959,123.8999]
  ];

  const getRoutes = () => typeof ROUTES !== 'undefined' ? ROUTES : [];
  const getMapPoints = () => typeof MAP_POINTS !== 'undefined' ? MAP_POINTS : [];
  const getMapLines = () => typeof MAP_LINES !== 'undefined' ? MAP_LINES : [];
  const coordCatalog = () => [
    ...getMapPoints().map(p=>({key:normalize(p.name),lat:p.lat,lng:p.lng,name:p.name})),
    ...extraPlaces.map(([name,lat,lng])=>({key:normalize(name),lat,lng,name}))
  ];
  let catalog = [];
  let map = null;
  let focusLayer = null;
  let focusedBounds = null;
  let focusedRouteId = null;
  let focusedTransfer = null;

  const coordFor = name => {
    const q=normalize(name); if(!q)return null;
    let hit=catalog.find(p=>p.key===q);
    if(!hit) hit=catalog.find(p=>q.includes(p.key)||p.key.includes(q));
    return hit?[hit.lat,hit.lng]:null;
  };
  const routeHas = (route,place) => route.stops.some(stop=>exactish(place,stop));
  const routePoints = (route,from='',to='') => {
    let stops=route.stops.slice();
    if(from&&to){
      const fromIndex=stops.findIndex(stop=>exactish(from,stop));
      const toIndex=stops.findIndex(stop=>exactish(to,stop));
      if(fromIndex>=0&&toIndex>=0&&fromIndex!==toIndex){
        stops=fromIndex<toIndex?stops.slice(fromIndex,toIndex+1):stops.slice(toIndex,fromIndex+1).reverse();
      }
    }
    const points=[];
    stops.forEach(stop=>{
      const c=coordFor(stop);
      if(c&&(!points.length||Math.abs(points.at(-1)[0]-c[0])>.00001||Math.abs(points.at(-1)[1]-c[1])>.00001)) points.push(c);
    });
    if(points.length<2){
      const fallback=getMapLines().find(line=>normalize(line.id)===normalize(route.code)||normalize(line.name).includes(normalize(route.code)));
      if(fallback)return fallback.points;
    }
    return points;
  };
  const bearing=(a,b)=>{const lat1=a[0]*Math.PI/180,lat2=b[0]*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180;const y=Math.sin(dLon)*Math.cos(lat2),x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);return(Math.atan2(y,x)*180/Math.PI+360)%360;};
  const midpoint=(a,b,t=.5)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
  const pinIcon=(kind,label)=>L.divIcon({className:'',html:`<div class="ctg-nav-pin ${kind}"><span>${label}</span></div>`,iconSize:[34,34],iconAnchor:[10,31]});
  const stopIcon=color=>L.divIcon({className:'',html:`<span class="ctg-route-stop" style="--route-color:${color}"></span>`,iconSize:[13,13],iconAnchor:[6.5,6.5]});
  const arrowIcon=(color,angle)=>L.divIcon({className:'',html:`<span class="ctg-direction-arrow" style="--route-color:${color};transform:rotate(${angle}deg)">➜</span>`,iconSize:[28,28],iconAnchor:[14,14]});

  function createMapChrome(){
    const card=document.querySelector('.map-card'); if(!card||card.querySelector('.ctg-map-controls'))return;
    card.insertAdjacentHTML('beforeend',`
      <div class="ctg-map-top" aria-live="polite"><div class="ctg-trip-summary" hidden><span class="ctg-trip-dot"></span><span class="ctg-trip-copy"><small class="ctg-trip-eyebrow">Selected route</small><strong class="ctg-trip-title">Route</strong></span><button class="ctg-map-close" type="button" aria-label="Clear selected route">×</button></div></div>
      <div class="ctg-map-controls" aria-label="Map controls"><button class="ctg-map-fab ctg-zoom-in" type="button" aria-label="Zoom in">+</button><button class="ctg-map-fab ctg-zoom-out" type="button" aria-label="Zoom out">−</button><button class="ctg-map-fab ctg-fit-route" type="button" aria-label="Fit selected route" title="Fit selected route" hidden>⌗</button><button class="ctg-map-fab ctg-overview" type="button" aria-label="Show Metro Cebu overview" title="Cebu overview">◎</button></div>
      <div class="ctg-nav-sheet" hidden><div class="ctg-sheet-handle" aria-hidden="true"></div><div class="ctg-sheet-row"><span class="ctg-sheet-badge">17B</span><div class="ctg-sheet-copy"><span class="ctg-sheet-mode">Jeepney</span><strong class="ctg-sheet-title">IT Park → Carbon</strong><small class="ctg-sheet-meta">Schematic direction · verify boarding point locally</small></div></div><div class="ctg-sheet-actions"><button class="ghost-btn compact ctg-sheet-details" type="button">Route details</button><button class="primary-btn compact ctg-sheet-fit" type="button">Fit route</button></div></div>
      <div class="ctg-schematic-label">Schematic route view · not turn-by-turn navigation</div>`);
    card.querySelector('.ctg-zoom-in').addEventListener('click',()=>map.zoomIn(.5));
    card.querySelector('.ctg-zoom-out').addEventListener('click',()=>map.zoomOut(.5));
    card.querySelector('.ctg-fit-route').addEventListener('click',fitFocused);
    card.querySelector('.ctg-sheet-fit').addEventListener('click',fitFocused);
    card.querySelector('.ctg-overview').addEventListener('click',resetOverview);
    card.querySelector('.ctg-map-close').addEventListener('click',clearFocus);
    card.querySelector('.ctg-sheet-details').addEventListener('click',event=>{const id=event.currentTarget.dataset.route;if(id)openExistingRouteDialog(id);});
    const reset=document.getElementById('fitMapBtn'); if(reset){reset.textContent='Cebu overview';reset.addEventListener('click',()=>setTimeout(resetOverview,0));}
    const panelText=document.querySelector('.map-panel > p'); if(panelText)panelText.textContent='Toggle transport types, then tap Map on a route or planner result to focus its direction.';
  }

  function staticPolylineOpacity(dimmed){
    map.eachLayer(layer=>{
      if(!(layer instanceof L.Polyline)||focusLayer.hasLayer(layer))return;
      if(layer.__ctgOriginalOpacity==null)layer.__ctgOriginalOpacity=layer.options.opacity ?? .72;
      if(typeof layer.setStyle==='function')layer.setStyle({opacity:dimmed?.16:layer.__ctgOriginalOpacity});
    });
  }
  function addRouteGraphic(route,color=colorFor(route.mode),opts={}){
    const points=routePoints(route,opts.from||'',opts.to||''); if(points.length<2)return[];
    L.polyline(points,{color:'#fff',weight:11,opacity:.95,lineCap:'round',lineJoin:'round',interactive:false}).addTo(focusLayer);
    L.polyline(points,{color,weight:6.5,opacity:1,lineCap:'round',lineJoin:'round'}).bindTooltip(`${route.code} · ${route.corridor}`,{className:'ctg-route-tooltip',sticky:true}).addTo(focusLayer);
    points.slice(1,-1).forEach(point=>L.marker(point,{icon:stopIcon(color),interactive:false}).addTo(focusLayer));
    const segments=[];
    for(let i=0;i<points.length-1;i++)if(points.length<=4||i===Math.floor((points.length-2)/2))segments.push(i);
    [...new Set(segments)].slice(0,3).forEach(i=>{const a=points[i],b=points[i+1];L.marker(midpoint(a,b,.55),{icon:arrowIcon(color,bearing(a,b)),interactive:false}).addTo(focusLayer);});
    if(!opts.skipPins){
      L.marker(points[0],{icon:pinIcon('start','A'),zIndexOffset:900}).bindTooltip(opts.from||route.stops[0],{direction:'top',className:'ctg-route-tooltip'}).addTo(focusLayer);
      L.marker(points.at(-1),{icon:pinIcon('end','B'),zIndexOffset:900}).bindTooltip(opts.to||route.stops.at(-1),{direction:'top',className:'ctg-route-tooltip'}).addTo(focusLayer);
    }
    return points;
  }
  function updateSheet({route=null,transfer='',title='',subtitle='',color='#7c4dff'}){
    const card=document.querySelector('.map-card'); if(!card)return;
    const summary=card.querySelector('.ctg-trip-summary'),sheet=card.querySelector('.ctg-nav-sheet'),dot=card.querySelector('.ctg-trip-dot'),details=card.querySelector('.ctg-sheet-details');
    summary.hidden=false;sheet.hidden=false;card.querySelector('.ctg-fit-route').hidden=false;dot.style.background=color;dot.style.boxShadow=`0 0 0 5px ${color}22`;
    card.querySelector('.ctg-trip-eyebrow').textContent=transfer?'Transfer trip':'Selected route';card.querySelector('.ctg-trip-title').textContent=title;
    card.querySelector('.ctg-sheet-badge').textContent=transfer?'1×':route.code;card.querySelector('.ctg-sheet-badge').style.background=color;card.querySelector('.ctg-sheet-mode').textContent=transfer?'One transfer':labelFor(route.mode);card.querySelector('.ctg-sheet-title').textContent=title;card.querySelector('.ctg-sheet-meta').textContent=subtitle;
    details.hidden=!route;details.dataset.route=route?.id||'';
  }
  function fitFocused(){
    if(!focusedBounds)return;
    const mobile=matchMedia('(max-width:640px)').matches;
    map.invalidateSize();
    map.flyToBounds(focusedBounds,{paddingTopLeft:[24,86],paddingBottomRight:[24,mobile?205:155],maxZoom:15.25,duration:.72,easeLinearity:.28});
  }
  function showRoute(id,{scroll=true,from='',to=''}={}){
    const route=getRoutes().find(item=>item.id===id);if(!route||!map)return;
    focusLayer.clearLayers();staticPolylineOpacity(true);focusedRouteId=id;focusedTransfer=null;
    const points=addRouteGraphic(route,colorFor(route.mode),{from,to});
    if(points.length<2){updateSheet({route,title:`${route.code} · ${route.corridor}`,subtitle:'Detailed map geometry is not yet available for every stop.',color:colorFor(route.mode)});return;}
    focusedBounds=L.latLngBounds(points);
    updateSheet({route,title:`${route.code} · ${route.corridor}`,subtitle:`${points.length} mapped points · arrows show route order`,color:colorFor(route.mode)});
    fitFocused();if(scroll)document.getElementById('map-section')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function showTransfer(aId,bId,common,{scroll=true,from='',to=''}={}){
    const a=getRoutes().find(item=>item.id===aId),b=getRoutes().find(item=>item.id===bId);if(!a||!b||!map)return;
    focusLayer.clearLayers();staticPolylineOpacity(true);focusedRouteId=null;focusedTransfer={aId,bId,common,from,to};
    const p1=addRouteGraphic(a,colorFor(a.mode),{skipPins:true,from,to:common}),p2=addRouteGraphic(b,colorFor(b.mode),{skipPins:true,from:common,to});const all=[...p1,...p2];if(all.length<2)return;
    L.marker(p1[0],{icon:pinIcon('start','A'),zIndexOffset:900}).bindTooltip(from||a.stops[0],{direction:'top',className:'ctg-route-tooltip'}).addTo(focusLayer);
    L.marker(p2.at(-1),{icon:pinIcon('end','B'),zIndexOffset:900}).bindTooltip(to||b.stops.at(-1),{direction:'top',className:'ctg-route-tooltip'}).addTo(focusLayer);
    const change=coordFor(common);if(change)L.marker(change,{icon:pinIcon('transfer','↻'),zIndexOffset:950}).bindTooltip(`Transfer: ${common}`,{direction:'top',className:'ctg-route-tooltip'}).addTo(focusLayer);
    focusedBounds=L.latLngBounds(all);updateSheet({transfer:common,title:`${a.code} → ${b.code}`,subtitle:`Transfer at ${common} · two colors show each leg`,color:'#7c4dff'});fitFocused();if(scroll)document.getElementById('map-section')?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function clearFocus(){focusLayer.clearLayers();staticPolylineOpacity(false);focusedBounds=null;focusedRouteId=null;focusedTransfer=null;const card=document.querySelector('.map-card');if(!card)return;card.querySelector('.ctg-trip-summary').hidden=true;card.querySelector('.ctg-nav-sheet').hidden=true;card.querySelector('.ctg-fit-route').hidden=true;}
  function resetOverview(){clearFocus();map.invalidateSize();map.flyToBounds([[10.18,123.74],[10.54,124.03]],{padding:[24,24],maxZoom:12.1,duration:.65});}

  function openExistingRouteDialog(id){
    const route=getRoutes().find(item=>item.id===id);if(!route)return;
    const card=document.querySelector(`.route-card[data-id="${CSS.escape(id)}"]`);if(card){card.click();return;}
    const search=document.getElementById('routeSearch');if(search){search.value=route.code;search.dispatchEvent(new Event('input',{bubbles:true}));setTimeout(()=>document.querySelector(`.route-card[data-id="${CSS.escape(id)}"]`)?.click(),0);}
  }
  function decorateRouteCards(){
    document.querySelectorAll('.route-card[data-id]').forEach(card=>{
      if(card.querySelector('.ctg-route-map-btn'))return;const bottom=card.querySelector('.route-card-bottom');if(!bottom)return;
      const button=document.createElement('button');button.type='button';button.className='ctg-route-map-btn';button.textContent='Map';button.setAttribute('aria-label','Show route on map');button.addEventListener('click',event=>{event.stopPropagation();showRoute(card.dataset.id,{scroll:true});});
      const favorite=bottom.querySelector('.favorite-btn');bottom.insertBefore(button,favorite||null);
    });
  }
  function currentPlan(){
    const from=document.getElementById('fromInput')?.value.trim()||'',to=document.getElementById('toInput')?.value.trim()||'';if(!from||!to)return{from,to,direct:[],transfers:[]};
    const routes=getRoutes(),direct=routes.filter(route=>routeHas(route,from)&&routeHas(route,to));const transfers=[];
    if(!direct.length){const first=routes.filter(route=>routeHas(route,from)),second=routes.filter(route=>routeHas(route,to));outer:for(const a of first){for(const b of second){if(a.id===b.id)continue;const common=a.stops.find(sa=>b.stops.some(sb=>exactish(sa,sb)));if(common){transfers.push({a,b,common});if(transfers.length>=4)break outer;}}}}
    return{from,to,direct,transfers};
  }
  function decoratePlanner(){
    const rows=[...document.querySelectorAll('#plannerResults .result-route')];if(!rows.length)return;const plan=currentPlan();
    rows.forEach((row,index)=>{
      if(row.querySelector('.ctg-result-map-btn'))return;
      const button=document.createElement('button');button.type='button';button.className='ctg-result-map-btn';button.textContent='Map';
      button.addEventListener('click',event=>{event.stopPropagation();if(plan.direct[index])showRoute(plan.direct[index].id,{scroll:true,from:plan.from,to:plan.to});else if(plan.transfers[index]){const t=plan.transfers[index];showTransfer(t.a.id,t.b.id,t.common,{scroll:true,from:plan.from,to:plan.to});}});
      const details=row.querySelector(':scope > button.text-btn');
      if(details){const actions=document.createElement('div');actions.className='ctg-result-actions';details.before(actions);actions.append(button,details);}
      else{const lastPill=row.querySelector(':scope > .route-code-pill:last-child');const actions=document.createElement('div');actions.className='ctg-result-actions';if(lastPill){lastPill.before(actions);actions.append(button,lastPill);}else row.append(button);}
    });
  }
  function decorateDialog(){
    const content=document.getElementById('routeDialogContent');if(!content||content.querySelector('.ctg-detail-map-action'))return;const code=content.querySelector('.detail-code')?.textContent.trim();if(!code)return;const route=getRoutes().find(item=>normalize(item.code)===normalize(code));if(!route)return;
    const target=content.querySelector('.detail-content');if(!target)return;const wrap=document.createElement('div');wrap.className='ctg-detail-map-action';wrap.innerHTML='<button class="primary-btn" type="button">Show route on map →</button>';wrap.querySelector('button').addEventListener('click',event=>{event.stopPropagation();document.getElementById('routeDialog')?.close();history.replaceState(null,'',location.pathname);showRoute(route.id,{scroll:true});});target.append(wrap);
  }
  function autoPreviewPlan(){
    const plan=currentPlan();if(plan.direct.length)showRoute(plan.direct[0].id,{scroll:false,from:plan.from,to:plan.to});else if(plan.transfers.length){const t=plan.transfers[0];showTransfer(t.a.id,t.b.id,t.common,{scroll:false,from:plan.from,to:plan.to});}else clearFocus();
  }
  function observeDynamicUI(){
    const observer=new MutationObserver(()=>{decorateRouteCards();decoratePlanner();decorateDialog();});
    ['routeGrid','plannerResults','routeDialogContent'].forEach(id=>{const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,subtree:true});});
    decorateRouteCards();decoratePlanner();decorateDialog();
    document.getElementById('findRouteBtn')?.addEventListener('click',()=>setTimeout(()=>{decoratePlanner();autoPreviewPlan();},0));
    document.querySelectorAll('.quick-chip').forEach(button=>button.addEventListener('click',()=>setTimeout(()=>{decoratePlanner();autoPreviewPlan();},0)));
  }

  function start(){
    map=window.__cebuTransportMap;if(!map||!window.L)return;catalog=coordCatalog();focusLayer=L.layerGroup().addTo(map);L.control.scale({metric:true,imperial:false,maxWidth:110,position:'bottomleft'}).addTo(map);createMapChrome();observeDynamicUI();setTimeout(()=>map.invalidateSize(),100);
  }
  if(window.__cebuTransportMap)start();else window.addEventListener('cebu-map-ready',start,{once:true});
})();
