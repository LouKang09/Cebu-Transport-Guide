(() => {
  const modeConfig = {
    jeepney:{label:'Jeepney',color:'#2563eb'},modern:{label:'Modern PUV',color:'#f08a24'},mybus:{label:'MyBus',color:'#f2bf2f'},
    beep:{label:'BEEP / CIBUS',color:'#95633a'},uv:{label:'UV Express',color:'#7c4dff'},bus:{label:'Provincial Bus',color:'#202632'},brt:{label:'Cebu BRT',color:'#13a8a0'}
  };
  const ROAD_ROUTER='https://router.project-osrm.org/route/v1/driving/';
  const MAX_ROUTER_WAYPOINTS=18;
  const roadGeometryCache=new Map();

  const normalize=value=>(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const exactish=(a,b)=>{const x=normalize(a),y=normalize(b);return x===y||x.includes(y)||y.includes(x);};
  const colorFor=mode=>modeConfig[mode]?.color||'#64748b';
  const labelFor=mode=>modeConfig[mode]?.label||mode;
  function hashString(value){
    let hash=2166136261;
    for(const char of String(value||'')){
      hash^=char.charCodeAt(0);
      hash=Math.imul(hash,16777619);
    }
    return hash>>>0;
  }

  function uniqueSegmentColor(routeKey,index,total){
    const seed=hashString(routeKey)%360;
    const hue=(seed+(index*137.50776405))%360;
    const saturation=72+((index*7)%17);
    const lightness=42+((index*11)%16);
    return `hsl(${hue.toFixed(1)} ${saturation}% ${lightness}%)`;
  }

  // Direction-specific profiles let return trips use different streets instead of
  // blindly reversing the outbound line. 04L is explicitly configured from the
  // commuter pattern supplied for this guide; other routes fall back to a clearly
  // labelled reverse estimate until a direction-specific profile is added.
  const directionProfiles={
    '04L':{
      forward:{label:'Lahug → Ayala → SM City Cebu',stops:['Lahug','Ayala','SM City Cebu'],verified:true},
      reverse:{label:'SM City Cebu → Landers → Kasambagan → Lahug',stops:['SM City Cebu','Landers Superstore Cebu','Kasambagan','Lahug'],verified:true}
    },
    '13C':{
      forward:{label:'Talamban → Country Mall → Ayala → Echavez → Colon',stops:['Talamban','Gaisano Country Mall','Ayala','Echavez','Colon'],verified:true},
      reverse:{label:'Colon → Echavez → Ayala → Country Mall → Talamban',stops:['Colon','Echavez','Ayala','Gaisano Country Mall','Talamban'],verified:false}
    }
  };

  const extraPlaces=[
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
    ['Mactan-Cebu International Airport',10.3075,123.9794],['MCIA',10.3075,123.9794],['Cebu Doctors University',10.3361,123.9351],['USC Downtown',10.2978,123.8980],['USJ-R',10.2959,123.8999],
    ['Landers Superstore Cebu',10.32072,123.90958],['Landers',10.32072,123.90958],['Kasambagan',10.3243,123.9101],['Echavez',10.3056,123.89988],
    ['Carmen Village',10.260813,123.822988],['Carmen Village Poblacion Talisay',10.260813,123.822988],['Carmen Village, Poblacion, Talisay',10.260813,123.822988]
  ];

  const getRoutes=()=>typeof ROUTES!=='undefined'?ROUTES:[];
  const getMapPoints=()=>typeof MAP_POINTS!=='undefined'?MAP_POINTS:[];
  const getMapLines=()=>typeof MAP_LINES!=='undefined'?MAP_LINES:[];
  const coordCatalog=()=>[
    ...getMapPoints().map(p=>({key:normalize(p.name),lat:p.lat,lng:p.lng,name:p.name})),
    ...extraPlaces.map(([name,lat,lng])=>({key:normalize(name),lat,lng,name}))
  ];

  let catalog=[];
  let map=null;
  let focusLayer=null;
  let focusedBounds=null;
  let focusedRouteId=null;
  let focusedTransfer=null;
  let focusRequestSerial=0;
  let expandingRouteBook=false;
  let expandTimer=null;
  let activeRouteView=null;
  let liveLayer=null;
  let liveWatchId=null;
  let liveMarker=null;
  let liveAccuracyCircle=null;
  let lastLivePosition=null;
  let followLiveLocation=true;
  let highlightedSegmentIndex=-1;
  let gpsSamples=[];
  let gpsWarmupStartedAt=0;
  let lastReliablePosition=null;
  const GPS_TARGET_ACCURACY=65;
  const GPS_MAX_ACCEPTABLE_ACCURACY=140;
  const GPS_SAMPLE_WINDOW_MS=12000;
  const GPS_MAX_JUMP_SPEED_MPS=55;
  const PLACE_SEARCH_URL='https://photon.komoot.io/api/';
  const CEBU_SEARCH_BBOX='123.2,9.2,124.4,11.6';
  const geocodeCache=new Map();
  const geocodeControllers=new WeakMap();
  let spatialRouteIndex=null;
  let spatialIndexPromise=null;
  let spatialPlannerSerial=0;
  let activeSpatialPlan=null;
  const SPATIAL_BOARD_MAX_METERS=1600;
  const SPATIAL_DROP_MAX_METERS=3600;
  const SPATIAL_TRANSFER_MAX_METERS=750;

  const coordFor=name=>{
    const q=normalize(name);if(!q)return null;
    let hit=catalog.find(p=>p.key===q);
    if(!hit)hit=catalog.find(p=>q.includes(p.key)||p.key.includes(q));
    return hit?[hit.lat,hit.lng]:null;
  };

  const routeHas=(route,place)=>['forward','reverse'].some(direction=>baseDirectionProfile(route,direction).stops.some(stop=>exactish(place,stop)));

  function dedupeNames(values){
    const seen=new Set();
    return values.filter(value=>{
      const key=normalize(value);
      if(!key||seen.has(key))return false;
      seen.add(key);
      return true;
    });
  }

  function genericMajorLocations(route){
    const stops=Array.isArray(route.stops)?route.stops.filter(Boolean):[];
    const landmarks=Array.isArray(route.landmarks)?route.landmarks.filter(Boolean):[];
    if(stops.length>=3)return dedupeNames(stops);
    if(stops.length===2)return dedupeNames([stops[0],...landmarks,stops[1]]);
    if(stops.length===1)return dedupeNames([stops[0],...landmarks]);
    return dedupeNames(landmarks);
  }

  function baseDirectionProfile(route,direction='forward'){
    const configured=directionProfiles[route.code]?.[direction];
    if(configured)return{...configured,direction};
    const forwardStops=genericMajorLocations(route);
    const stops=direction==='reverse'?[...forwardStops].reverse():forwardStops;
    return{
      direction,
      label:stops.join(' → ')||route.corridor||route.code,
      stops,
      verified:direction==='forward',
      generated:true
    };
  }

  function inferDirection(route,from='',to='',requested=''){
    if(requested==='forward'||requested==='reverse')return requested;
    if(from&&to){
      for(const direction of ['forward','reverse']){
        const profile=baseDirectionProfile(route,direction);
        const fromIndex=profile.stops.findIndex(stop=>exactish(from,stop));
        const toIndex=profile.stops.findIndex(stop=>exactish(to,stop));
        if(fromIndex>=0&&toIndex>=0&&fromIndex<toIndex)return direction;
      }
    }
    return'forward';
  }

  function routeWaypoints(route,{from='',to='',direction=''}={}){
    const resolvedDirection=inferDirection(route,from,to,direction);
    const profile=baseDirectionProfile(route,resolvedDirection);
    let stops=[...profile.stops];

    if(from&&to){
      const fromIndex=stops.findIndex(stop=>exactish(from,stop));
      const toIndex=stops.findIndex(stop=>exactish(to,stop));
      if(fromIndex>=0&&toIndex>=0&&fromIndex<toIndex)stops=stops.slice(fromIndex,toIndex+1);
    }

    const waypoints=[];
    stops.forEach(name=>{
      const coord=coordFor(name);
      if(!coord)return;
      const previous=waypoints.at(-1);
      if(!previous||Math.abs(previous.coord[0]-coord[0])>.00001||Math.abs(previous.coord[1]-coord[1])>.00001){
        waypoints.push({name,coord});
      }
    });

    if(waypoints.length<2){
      const fallback=getMapLines().find(line=>normalize(line.id)===normalize(route.code)||normalize(line.name).includes(normalize(route.code)));
      if(fallback?.points?.length>1){
        return{
          profile,
          waypoints:fallback.points.map((coord,index)=>({name:index===0?stops[0]||route.code:index===fallback.points.length-1?stops.at(-1)||route.code:`Route point ${index+1}`,coord}))
        };
      }
    }
    return{profile,waypoints};
  }

  const routePoints=(route,from='',to='',direction='')=>routeWaypoints(route,{from,to,direction}).waypoints.map(item=>item.coord);

  const thinWaypoints=(points,max=MAX_ROUTER_WAYPOINTS)=>{
    if(points.length<=max)return points;
    const sampled=[];
    for(let i=0;i<max;i++){
      const index=Math.round(i*(points.length-1)/(max-1));
      const point=points[index];
      if(!sampled.length||sampled.at(-1)[0]!==point[0]||sampled.at(-1)[1]!==point[1])sampled.push(point);
    }
    return sampled;
  };

  async function fetchRoadGeometry(via){
    if(via.length<2)return{geometry:[],distance:null,roadFollowed:false};
    const waypoints=thinWaypoints(via);
    const key=waypoints.map(([lat,lng])=>`${lat.toFixed(5)},${lng.toFixed(5)}`).join('|');
    if(roadGeometryCache.has(key))return roadGeometryCache.get(key);

    const promise=(async()=>{
      const coords=waypoints.map(([lat,lng])=>`${lng.toFixed(6)},${lat.toFixed(6)}`).join(';');
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),9000);
      try{
        const response=await fetch(`${ROAD_ROUTER}${coords}?overview=full&geometries=geojson&steps=false&annotations=false&continue_straight=false`,{
          signal:controller.signal,
          mode:'cors',
          credentials:'omit',
          referrerPolicy:'no-referrer'
        });
        if(!response.ok)throw new Error(`Routing service returned ${response.status}`);
        const data=await response.json();
        const route=data?.routes?.[0];
        const coordinates=route?.geometry?.coordinates;
        if(data?.code!=='Ok'||!Array.isArray(coordinates)||coordinates.length<2)throw new Error('No road geometry returned');
        return{
          geometry:coordinates.map(([lng,lat])=>[lat,lng]),
          distance:Number.isFinite(route.distance)?route.distance:null,
          roadFollowed:true
        };
      }catch(error){
        return{geometry:[],distance:null,roadFollowed:false,error:error?.name==='AbortError'?'Road routing timed out':String(error?.message||error)};
      }finally{
        clearTimeout(timeout);
      }
    })();

    roadGeometryCache.set(key,promise);
    const result=await promise;
    if(!result.roadFollowed)roadGeometryCache.delete(key);
    return result;
  }

  function nearestGeometryIndex(geometry,coord,startIndex=0){
    let bestIndex=startIndex;
    let bestDistance=Infinity;
    for(let i=startIndex;i<geometry.length;i++){
      const dLat=geometry[i][0]-coord[0];
      const dLng=(geometry[i][1]-coord[1])*Math.cos(coord[0]*Math.PI/180);
      const score=dLat*dLat+dLng*dLng;
      if(score<bestDistance){bestDistance=score;bestIndex=i;}
    }
    return bestIndex;
  }

  function splitGeometryByWaypoints(geometry,waypoints,colorKey='route'){
    if(geometry.length<2||waypoints.length<2)return[];
    const indices=[];
    let cursor=0;
    waypoints.forEach((waypoint,index)=>{
      const found=nearestGeometryIndex(geometry,waypoint.coord,cursor);
      const clamped=index===waypoints.length-1?geometry.length-1:found;
      indices.push(clamped);
      cursor=Math.min(geometry.length-1,clamped);
    });
    indices[0]=0;
    indices[indices.length-1]=geometry.length-1;

    return waypoints.slice(0,-1).map((from,index)=>{
      const start=indices[index];
      const end=Math.max(start+1,indices[index+1]);
      const segmentGeometry=geometry.slice(start,Math.min(geometry.length,end+1));
      return{
        index,
        from,
        to:waypoints[index+1],
        geometry:segmentGeometry.length>1?segmentGeometry:[from.coord,waypoints[index+1].coord],
        color:uniqueSegmentColor(`${colorKey}|${waypoints.map(item=>item.name).join('|')}`,index,waypoints.length-1),
        layer:null
      };
    });
  }

  async function resolveRoutePath(route,opts={}){
    const routeInfo=routeWaypoints(route,opts);
    const waypoints=routeInfo.waypoints;
    const via=waypoints.map(item=>item.coord);
    if(via.length<2)return{...routeInfo,via,geometry:via,segments:[],distance:null,roadFollowed:false};
    const road=await fetchRoadGeometry(via);
    const geometry=road.roadFollowed?road.geometry:via;
    return{
      ...routeInfo,
      via,
      geometry,
      segments:road.roadFollowed?splitGeometryByWaypoints(geometry,waypoints,`${route.id||route.code}|${route.code}|${routeInfo.profile.direction}`):[],
      distance:road.distance,
      roadFollowed:road.roadFollowed,
      error:road.error
    };
  }

  const bearing=(a,b)=>{
    const lat1=a[0]*Math.PI/180,lat2=b[0]*Math.PI/180,dLon=(b[1]-a[1])*Math.PI/180;
    const y=Math.sin(dLon)*Math.cos(lat2);
    const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
    return(Math.atan2(y,x)*180/Math.PI+360)%360;
  };

  const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const pinIcon=(kind,label)=>L.divIcon({className:'',html:`<div class="ctg-nav-pin ${kind}"><span>${escapeHtml(label)}</span></div>`,iconSize:[34,34],iconAnchor:[10,31]});
  const boardDropIcon=(kind,label)=>L.divIcon({
    className:'',
    html:`<div class="ctg-board-drop ${kind}"><span class="ctg-board-drop-dot"></span><strong>${escapeHtml(label)}</strong></div>`,
    iconSize:[92,34],
    iconAnchor:[16,28]
  });
  const stopIcon=color=>L.divIcon({className:'',html:`<span class="ctg-route-stop" style="--route-color:${color}"></span>`,iconSize:[13,13],iconAnchor:[6.5,6.5]});
  const arrowIcon=(color,angle)=>L.divIcon({className:'',html:`<span class="ctg-direction-arrow" style="--route-color:${color};transform:rotate(${angle}deg)">➜</span>`,iconSize:[28,28],iconAnchor:[14,14]});
  const waypointIcon=(index,color,name)=>L.divIcon({
    className:'',
    html:`<div class="ctg-waypoint-wrap"><span class="ctg-waypoint-pin" style="--waypoint-color:${color}">${index+1}</span><span class="ctg-waypoint-map-label">${escapeHtml(name)}</span></div>`,
    iconSize:[118,42],
    iconAnchor:[18,20]
  });
  const liveLocationIcon=status=>L.divIcon({
    className:'',
    html:`<div class="ctg-live-marker ${status||'tracking'}"><span></span></div>`,
    iconSize:[28,28],
    iconAnchor:[14,14]
  });

  function createMapChrome(){
    const card=document.querySelector('.map-card');
    if(!card||card.querySelector('.ctg-map-controls'))return;
    card.insertAdjacentHTML('beforeend',`
      <div class="ctg-map-top" aria-live="polite"><div class="ctg-trip-summary" hidden><span class="ctg-trip-dot"></span><span class="ctg-trip-copy"><small class="ctg-trip-eyebrow">Selected route</small><strong class="ctg-trip-title">Route</strong></span><span class="ctg-route-loading" hidden aria-hidden="true"></span><button class="ctg-map-close" type="button" aria-label="Clear selected route">×</button></div></div>
      <div class="ctg-map-controls" aria-label="Map controls">
        <button class="ctg-map-fab ctg-location" type="button" aria-label="Share live location" title="Share live location">⌖</button>
        <button class="ctg-map-fab ctg-legend-toggle" type="button" aria-label="Show map legend" aria-expanded="false" title="Map legend">≡</button>
        <button class="ctg-map-fab ctg-zoom-in" type="button" aria-label="Zoom in">+</button>
        <button class="ctg-map-fab ctg-zoom-out" type="button" aria-label="Zoom out">−</button>
        <button class="ctg-map-fab ctg-fit-route" type="button" aria-label="Fit selected route" title="Fit selected route" hidden>⌗</button>
        <button class="ctg-map-fab ctg-overview" type="button" aria-label="Show Metro Cebu overview" title="Cebu overview">◎</button>
      </div>
      <div class="ctg-map-legend" hidden aria-label="Map legend">
        <div class="ctg-map-legend-head">
          <div><small>MAP KEY</small><strong>Legend</strong></div>
          <button class="ctg-map-legend-close" type="button" aria-label="Close map legend">×</button>
        </div>
        <div class="ctg-map-legend-symbols">
          <span><i class="ctg-legend-dot wait"></i>Wait here</span>
          <span><i class="ctg-legend-dot drop"></i>Drop here</span>
          <span><i class="ctg-legend-dot you"></i>Your location</span>
        </div>
        <div class="ctg-map-legend-divider"></div>
        <small class="ctg-map-legend-label">TRANSPORT LAYERS</small>
        <div class="ctg-map-legend-modes"></div>
        <div class="ctg-map-legend-route" hidden>
          <div class="ctg-map-legend-divider"></div>
          <small class="ctg-map-legend-label">SELECTED ROUTE SECTIONS</small>
          <div class="ctg-map-legend-sections"></div>
        </div>
      </div>
      <div class="ctg-nav-sheet" hidden>
        <div class="ctg-sheet-handle" aria-hidden="true"></div>
        <div class="ctg-sheet-row"><span class="ctg-sheet-badge">17B</span><div class="ctg-sheet-copy"><span class="ctg-sheet-mode">Jeepney</span><strong class="ctg-sheet-title">IT Park → Carbon</strong><small class="ctg-sheet-meta">Following mapped roads…</small></div></div>
        <div class="ctg-direction-switch" hidden aria-label="Route direction">
          <button type="button" data-direction="forward">Outbound</button>
          <button type="button" data-direction="reverse">Return</button>
          <small class="ctg-direction-note"></small>
        </div>
        <div class="ctg-waypoint-strip" hidden aria-label="Major locations on this route"></div>
        <div class="ctg-live-status" hidden aria-live="polite">
          <span class="ctg-live-dot"></span>
          <div class="ctg-live-copy"><strong>Live location</strong><small>Waiting for GPS…</small></div>
          <button class="ctg-live-follow" type="button">Follow</button>
          <button class="ctg-live-stop" type="button">Stop</button>
        </div>
        <div class="ctg-sheet-actions"><button class="ghost-btn compact ctg-sheet-details" type="button">Route details</button><button class="primary-btn compact ctg-sheet-fit" type="button">Fit route</button></div>
      </div>
      <div class="ctg-schematic-label">Road-following estimate from mapped route points</div>`);

    card.querySelector('.ctg-location').addEventListener('click',toggleLiveLocation);
    card.querySelector('.ctg-legend-toggle').addEventListener('click',()=>setMapLegendOpen(card.querySelector('.ctg-map-legend').hidden));
    card.querySelector('.ctg-map-legend-close').addEventListener('click',()=>setMapLegendOpen(false));
    card.querySelector('.ctg-zoom-in').addEventListener('click',()=>map.zoomIn(.5));
    card.querySelector('.ctg-zoom-out').addEventListener('click',()=>map.zoomOut(.5));
    card.querySelector('.ctg-fit-route').addEventListener('click',fitFocused);
    card.querySelector('.ctg-sheet-fit').addEventListener('click',fitFocused);
    card.querySelector('.ctg-overview').addEventListener('click',resetOverview);
    card.querySelector('.ctg-map-close').addEventListener('click',clearFocus);
    card.querySelector('.ctg-sheet-details').addEventListener('click',event=>{const id=event.currentTarget.dataset.route;if(id)openExistingRouteDialog(id);});

    card.querySelector('.ctg-direction-switch').addEventListener('click',event=>{
      const button=event.target.closest('button[data-direction]');
      if(!button||!activeRouteView?.route)return;
      showRoute(activeRouteView.route.id,{scroll:false,direction:button.dataset.direction});
    });

    card.querySelector('.ctg-waypoint-strip').addEventListener('click',event=>{
      const button=event.target.closest('button[data-waypoint-index]');
      const index=Number(button?.dataset.waypointIndex);
      const waypoint=activeRouteView?.resolved?.waypoints?.[index];
      if(!waypoint)return;
      map.flyTo(waypoint.coord,Math.max(map.getZoom(),15.5),{duration:.55});
    });

    card.querySelector('.ctg-live-follow').addEventListener('click',()=>{
      followLiveLocation=true;
      if(lastLivePosition)map.flyTo([lastLivePosition.lat,lastLivePosition.lng],Math.max(map.getZoom(),16),{duration:.5});
      updateLiveFollowButton();
    });
    card.querySelector('.ctg-live-stop').addEventListener('click',stopLiveLocation);

    const reset=document.getElementById('fitMapBtn');
    if(reset){
      reset.textContent='Cebu overview';
      reset.addEventListener('click',()=>setTimeout(resetOverview,0));
    }
    const panelText=document.querySelector('.map-panel > p');
    if(panelText)panelText.textContent='Tap Map on a route to see color-coded major locations, switch outbound/return direction, or opt in to live GPS route tracking. The same legend is now available directly on the map.';
    buildMapLegendModes();
    setMapLegendOpen(!matchMedia('(max-width:640px)').matches);

    document.querySelector('.map-panel')?.addEventListener('click',event=>{
      if(event.target.closest('button'))setTimeout(syncMapLegendModes,0);
    });
  }

  function setMapLegendOpen(open){
    const legend=document.querySelector('.ctg-map-legend');
    const button=document.querySelector('.ctg-legend-toggle');
    if(!legend||!button)return;
    legend.hidden=!open;
    button.classList.toggle('active',open);
    button.setAttribute('aria-expanded',open?'true':'false');
    button.setAttribute('aria-label',open?'Hide map legend':'Show map legend');
  }

  function findSidebarLayerButton(label){
    const wanted=normalize(label);
    return [...document.querySelectorAll('.map-panel button')].find(button=>{
      const text=normalize(button.textContent);
      return text===wanted||text.includes(wanted)||wanted.includes(text);
    })||null;
  }

  function sidebarLayerIsActive(button){
    if(!button)return true;
    if(button.getAttribute('aria-pressed')==='false')return false;
    if(button.matches('.off,.inactive,.disabled,[data-active="false"]'))return false;
    return true;
  }

  function syncMapLegendModes(){
    document.querySelectorAll('.ctg-map-legend-mode[data-mode]').forEach(row=>{
      const mode=row.dataset.mode;
      const config=modeConfig[mode];
      const source=findSidebarLayerButton(config?.label||mode);
      const active=sidebarLayerIsActive(source);
      row.classList.toggle('inactive',!active);
      row.setAttribute('aria-pressed',active?'true':'false');
    });
  }

  function buildMapLegendModes(){
    const host=document.querySelector('.ctg-map-legend-modes');
    if(!host)return;
    host.replaceChildren(...Object.entries(modeConfig).map(([mode,config])=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='ctg-map-legend-mode';
      button.dataset.mode=mode;
      button.setAttribute('aria-pressed','true');
      const swatch=document.createElement('i');
      swatch.className='ctg-legend-line';
      swatch.style.setProperty('--legend-color',config.color);
      const label=document.createElement('span');
      label.textContent=config.label;
      button.append(swatch,label);
      button.addEventListener('click',()=>{
        const source=findSidebarLayerButton(config.label);
        if(source){
          source.click();
          setTimeout(syncMapLegendModes,0);
        }
      });
      return button;
    }));
    syncMapLegendModes();
  }

  function renderMapLegendRouteSections(route,resolved){
    const wrapper=document.querySelector('.ctg-map-legend-route');
    const host=document.querySelector('.ctg-map-legend-sections');
    if(!wrapper||!host)return;
    const segments=resolved?.segments||[];
    if(!route||!segments.length){
      wrapper.hidden=true;
      host.replaceChildren();
      return;
    }

    wrapper.hidden=false;
    host.replaceChildren(...segments.map((segment,index)=>{
      const row=document.createElement('button');
      row.type='button';
      row.className='ctg-map-legend-section';
      row.dataset.segmentIndex=String(index);
      const swatch=document.createElement('i');
      swatch.className='ctg-legend-line';
      swatch.style.setProperty('--legend-color',segment.color);
      const text=document.createElement('span');
      text.textContent=`${segment.from.name} → ${segment.to.name}`;
      row.append(swatch,text);
      row.addEventListener('click',()=>{
        const bounds=L.latLngBounds(segment.geometry);
        map.flyToBounds(bounds,{padding:[40,40],maxZoom:17,duration:.55});
      });
      return row;
    }));
  }

  function updateMapLegendCurrentSegment(index){
    document.querySelectorAll('.ctg-map-legend-section').forEach(row=>{
      row.classList.toggle('current',Number(row.dataset.segmentIndex)===index);
    });
  }

  function setGeometryLabel(text){
    const label=document.querySelector('.ctg-schematic-label');
    if(label)label.textContent=text;
  }

  function setMapLoading(isLoading){
    const spinner=document.querySelector('.ctg-route-loading');
    if(spinner)spinner.hidden=!isLoading;
  }

  function staticPolylineOpacity(dimmed){
    map.eachLayer(layer=>{
      if(!(layer instanceof L.Polyline)||focusLayer.hasLayer(layer))return;
      if(layer.__ctgOriginalOpacity==null)layer.__ctgOriginalOpacity=layer.options.opacity??.72;
      if(typeof layer.setStyle==='function')layer.setStyle({opacity:dimmed?.08:layer.__ctgOriginalOpacity});
    });
  }

  function addDirectionArrows(geometry,color){
    if(geometry.length<3)return;
    const ratios=geometry.length<16?[.48]:[.22,.5,.78];
    ratios.forEach(ratio=>{
      const index=Math.min(geometry.length-2,Math.max(0,Math.floor((geometry.length-1)*ratio)));
      const a=geometry[index],b=geometry[index+1];
      if(a&&b)L.marker(a,{icon:arrowIcon(color,bearing(a,b)),interactive:false,zIndexOffset:500}).addTo(focusLayer);
    });
  }

  function drawResolvedRoute(route,resolved,color=colorFor(route.mode),opts={}){
    const {waypoints,segments,roadFollowed}=resolved;

    if(roadFollowed&&segments.length){
      segments.forEach(segment=>{
        const segmentColor=opts.segmentColorMode==='base'?color:segment.color;
        L.polyline(segment.geometry,{color:'#fff',weight:11,opacity:.96,lineCap:'round',lineJoin:'round',interactive:false}).addTo(focusLayer);
        segment.layer=L.polyline(segment.geometry,{color:segmentColor,weight:6.5,opacity:1,lineCap:'round',lineJoin:'round'})
          .bindTooltip(`${segment.from.name} → ${segment.to.name}`,{className:'ctg-route-tooltip',sticky:true})
          .addTo(focusLayer);
        addDirectionArrows(segment.geometry,segmentColor);
      });
    }

    if(!opts.skipPins){
      waypoints.forEach((waypoint,index)=>{
        if(index===0||index===waypoints.length-1)return;
        const waypointColor=segments[index-1]?.color||segments.at(-1)?.color||color;
        L.marker(waypoint.coord,{icon:waypointIcon(index,waypointColor,waypoint.name),zIndexOffset:850+index})
          .bindTooltip(waypoint.name,{direction:'top',className:'ctg-route-tooltip'})
          .addTo(focusLayer);
      });

      const waitPoint=opts.waitCoord||waypoints[0]?.coord;
      const dropPoint=opts.dropCoord||waypoints.at(-1)?.coord;
      const waitName=opts.waitName||waypoints[0]?.name||'Boarding point';
      const dropName=opts.dropName||waypoints.at(-1)?.name||'Drop-off point';

      if(waitPoint){
        L.marker(waitPoint,{icon:boardDropIcon('wait','WAIT HERE'),zIndexOffset:1100})
          .bindTooltip(`Wait here · ${waitName}`,{direction:'top',className:'ctg-route-tooltip'})
          .addTo(focusLayer);
      }
      if(dropPoint){
        L.marker(dropPoint,{icon:boardDropIcon('drop','DROP HERE'),zIndexOffset:1090})
          .bindTooltip(`Drop here · ${dropName}`,{direction:'top',className:'ctg-route-tooltip'})
          .addTo(focusLayer);
      }
    }
  }

  function renderWaypointStrip(resolved){
    const strip=document.querySelector('.ctg-waypoint-strip');
    if(!strip)return;
    const waypoints=resolved?.waypoints||[];
    if(waypoints.length<2){
      strip.hidden=true;
      strip.replaceChildren();
      return;
    }

    strip.hidden=false;
    strip.replaceChildren(...waypoints.map((waypoint,index)=>{
      const button=document.createElement('button');
      const color=index===0?(resolved.segments[0]?.color||'#2563eb'):(resolved.segments[index-1]?.color||resolved.segments.at(-1)?.color||'#2563eb');
      button.type='button';
      button.dataset.waypointIndex=String(index);
      button.className='ctg-waypoint-chip';
      button.style.setProperty('--waypoint-color',color);
      const number=document.createElement('span');
      number.textContent=String(index+1);
      const label=document.createElement('strong');
      label.textContent=waypoint.name;
      button.append(number,label);
      return button;
    }));
  }

  function renderDirectionSwitch(route,resolved,allowDirection=true){
    const wrapper=document.querySelector('.ctg-direction-switch');
    if(!wrapper)return;
    if(!route||!allowDirection){
      wrapper.hidden=true;
      return;
    }
    wrapper.hidden=false;
    const current=resolved?.profile?.direction||'forward';
    wrapper.querySelectorAll('button[data-direction]').forEach(button=>{
      const active=button.dataset.direction===current;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
    });
    const profile=resolved?.profile;
    const note=wrapper.querySelector('.ctg-direction-note');
    if(note){
      note.textContent=current==='reverse'&&!profile?.verified
        ? 'Return direction is an estimate until a direction-specific route is verified.'
        : current==='reverse'
          ? 'Direction-specific return path'
          : 'Outbound path';
    }
  }


  function updateSheet({route=null,transfer='',title='',subtitle='',color='#7c4dff',loading=false,resolved=null,allowDirection=true}){
    const card=document.querySelector('.map-card');
    if(!card)return;
    const summary=card.querySelector('.ctg-trip-summary');
    const sheet=card.querySelector('.ctg-nav-sheet');
    const dot=card.querySelector('.ctg-trip-dot');
    const details=card.querySelector('.ctg-sheet-details');

    summary.hidden=false;
    sheet.hidden=false;
    card.querySelector('.ctg-fit-route').hidden=loading||!focusedBounds;
    dot.style.background=color;
    dot.style.boxShadow=`0 0 0 5px ${color}22`;
    card.querySelector('.ctg-trip-eyebrow').textContent=transfer?'Transfer trip':'Selected route';
    card.querySelector('.ctg-trip-title').textContent=title;
    card.querySelector('.ctg-sheet-badge').textContent=transfer?'1×':route?.code||'…';
    card.querySelector('.ctg-sheet-badge').style.background=color;
    card.querySelector('.ctg-sheet-mode').textContent=loading?'Matching roads…':transfer?'One transfer':labelFor(route?.mode);
    card.querySelector('.ctg-sheet-title').textContent=title;
    card.querySelector('.ctg-sheet-meta').textContent=subtitle;
    details.hidden=!route||loading;
    details.dataset.route=route?.id||'';
    setMapLoading(loading);

    if(loading){
      document.querySelector('.ctg-direction-switch')?.setAttribute('hidden','');
      document.querySelector('.ctg-waypoint-strip')?.setAttribute('hidden','');
    }else{
      renderDirectionSwitch(route,resolved,allowDirection&&!transfer);
      renderWaypointStrip(transfer?null:resolved);
      renderMapLegendRouteSections(transfer?null:route,transfer?null:resolved);
    }

    updateLiveStatusUI();
  }


  function fitFocused(){
    if(!focusedBounds)return;
    const mobile=matchMedia('(max-width:640px)').matches;
    map.invalidateSize();
    map.flyToBounds(focusedBounds,{
      paddingTopLeft:mobile?[20,88]:[28,92],
      paddingBottomRight:mobile?[20,188]:[28,156],
      maxZoom:mobile?16.2:16.5,
      duration:.72,
      easeLinearity:.28
    });
  }

  async function showRoute(id,{scroll=true,from='',to='',direction=''}={}){
    const route=getRoutes().find(item=>item.id===id);
    if(!route||!map)return;

    const serial=++focusRequestSerial;
    focusLayer.clearLayers();
    staticPolylineOpacity(true);
    focusedRouteId=id;
    focusedTransfer=null;
    focusedBounds=null;
    activeRouteView=null;
    highlightedSegmentIndex=-1;

    const preview=routeWaypoints(route,{from,to,direction});
    const previewTitle=`${route.code} · ${preview.profile.label}`;

    updateSheet({
      route,
      title:previewTitle,
      subtitle:'Matching named locations to Cebu roads…',
      color:colorFor(route.mode),
      loading:true
    });
    setGeometryLabel('Matching route to the road network…');

    const resolved=await resolveRoutePath(route,{from,to,direction});
    if(serial!==focusRequestSerial)return;

    focusLayer.clearLayers();
    drawResolvedRoute(route,resolved,colorFor(route.mode),{from,to});
    if(resolved.geometry.length>1)focusedBounds=L.latLngBounds(resolved.geometry);
    else if(resolved.via.length)focusedBounds=L.latLngBounds(resolved.via);

    activeRouteView={
      route,
      resolved,
      direction:resolved.profile.direction,
      from,
      to
    };

    const km=resolved.distance!=null?`${(resolved.distance/1000).toFixed(1)} km · `:'';
    const directionLabel=resolved.profile.direction==='reverse'?'Return':'Outbound';
    if(resolved.roadFollowed){
      setGeometryLabel('Color sections mark major locations · live GPS can compare your position with this road-following route');
      updateSheet({
        route,
        resolved,
        title:`${route.code} · ${resolved.profile.label}`,
        subtitle:`${directionLabel} · ${km}${resolved.waypoints.length} named locations · tap a colored location below`,
        color:colorFor(route.mode)
      });
    }else{
      setGeometryLabel('Road routing unavailable right now · mapped location pins only');
      updateSheet({
        route,
        resolved,
        title:`${route.code} · ${resolved.profile.label}`,
        subtitle:'Road path unavailable right now. Showing named location pins without a misleading straight line.',
        color:colorFor(route.mode)
      });
    }

    if(lastLivePosition)updateLiveRouteStatus(lastLivePosition);
    if(focusedBounds)fitFocused();
    if(scroll)document.getElementById('map-section')?.scrollIntoView({behavior:'smooth',block:'start'});
  }


  async function showTransfer(aId,bId,common,{scroll=true,from='',to=''}={}){
    const a=getRoutes().find(item=>item.id===aId);
    const b=getRoutes().find(item=>item.id===bId);
    if(!a||!b||!map)return;

    const serial=++focusRequestSerial;
    focusLayer.clearLayers();
    staticPolylineOpacity(true);
    focusedRouteId=null;
    focusedTransfer={aId,bId,common,from,to};
    focusedBounds=null;
    activeRouteView=null;
    highlightedSegmentIndex=-1;

    updateSheet({
      transfer:common,
      title:`${a.code} → ${b.code}`,
      subtitle:`Matching both legs to roads via ${common}…`,
      color:'#7c4dff',
      loading:true
    });
    setGeometryLabel('Matching transfer trip to the road network…');

    const [leg1,leg2]=await Promise.all([
      resolveRoutePath(a,{from,to:common}),
      resolveRoutePath(b,{from:common,to})
    ]);
    if(serial!==focusRequestSerial)return;

    focusLayer.clearLayers();
    drawResolvedRoute(a,leg1,colorFor(a.mode),{skipPins:true,segmentColorMode:'base',from,to:common});
    drawResolvedRoute(b,leg2,colorFor(b.mode),{skipPins:true,segmentColorMode:'base',from:common,to});

    const allGeometry=[...leg1.geometry,...leg2.geometry];
    const start=leg1.via[0],end=leg2.via.at(-1);
    if(start)L.marker(start,{icon:pinIcon('start','A'),zIndexOffset:900}).bindTooltip(from||a.stops[0],{direction:'top',className:'ctg-route-tooltip'}).addTo(focusLayer);
    if(end)L.marker(end,{icon:pinIcon('end','B'),zIndexOffset:900}).bindTooltip(to||b.stops.at(-1),{direction:'top',className:'ctg-route-tooltip'}).addTo(focusLayer);
    const change=coordFor(common);
    if(change)L.marker(change,{icon:pinIcon('transfer','↻'),zIndexOffset:950}).bindTooltip(`Transfer: ${common}`,{direction:'top',className:'ctg-route-tooltip'}).addTo(focusLayer);

    if(allGeometry.length>1)focusedBounds=L.latLngBounds(allGeometry);
    const bothRoadFollowed=leg1.roadFollowed&&leg2.roadFollowed;
    const distance=(leg1.distance||0)+(leg2.distance||0);
    const km=distance>0?`${(distance/1000).toFixed(1)} km · `:'';

    setGeometryLabel(bothRoadFollowed?'Road-following transfer estimate via OpenStreetMap roads · actual PUV turns may vary':'Some road geometry is unavailable · mapped stops remain visible');
    updateSheet({
      transfer:common,
      title:`${a.code} → ${b.code}`,
      subtitle:bothRoadFollowed?`${km}transfer at ${common} · each leg follows mapped roads`:`Transfer at ${common} · one or more road paths could not be resolved`,
      color:'#7c4dff'
    });

    if(focusedBounds)fitFocused();
    if(scroll)document.getElementById('map-section')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  const toRadians=value=>value*Math.PI/180;

  function haversineMeters(a,b){
    const R=6371000;
    const dLat=toRadians(b[0]-a[0]);
    const dLng=toRadians(b[1]-a[1]);
    const lat1=toRadians(a[0]);
    const lat2=toRadians(b[0]);
    const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
    return 2*R*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
  }

  function pointToSegmentMeters(point,a,b){
    const refLat=toRadians(point[0]);
    const metersPerLat=111320;
    const metersPerLng=111320*Math.cos(refLat);
    const px=(point[1]-a[1])*metersPerLng;
    const py=(point[0]-a[0])*metersPerLat;
    const bx=(b[1]-a[1])*metersPerLng;
    const by=(b[0]-a[0])*metersPerLat;
    const lengthSquared=bx*bx+by*by;
    if(lengthSquared===0)return Math.hypot(px,py);
    const t=Math.max(0,Math.min(1,(px*bx+py*by)/lengthSquared));
    return Math.hypot(px-t*bx,py-t*by);
  }

  function geometryDistanceMeters(point,geometry){
    let best=Infinity;
    for(let i=0;i<geometry.length-1;i++){
      best=Math.min(best,pointToSegmentMeters(point,geometry[i],geometry[i+1]));
    }
    return best;
  }

  function formatDistance(meters){
    if(!Number.isFinite(meters))return'';
    if(meters<1000)return`~${Math.max(10,Math.round(meters/10)*10)} m`;
    return`~${(meters/1000).toFixed(1)} km`;
  }

  function setLiveMessage(title,meta,state='tracking'){
    const row=document.querySelector('.ctg-live-status');
    if(!row||liveWatchId===null)return;
    row.hidden=false;
    row.dataset.state=state;
    row.querySelector('.ctg-live-copy strong').textContent=title;
    row.querySelector('.ctg-live-copy small').textContent=meta;
    if(liveMarker)liveMarker.setIcon(liveLocationIcon(state));
  }

  function updateLiveFollowButton(){
    const button=document.querySelector('.ctg-live-follow');
    if(!button)return;
    button.textContent=followLiveLocation?'Following':'Follow';
    button.classList.toggle('active',followLiveLocation);
    button.setAttribute('aria-pressed',followLiveLocation?'true':'false');
  }

  function highlightActiveSegment(index){
    if(!activeRouteView?.resolved?.segments)return;
    activeRouteView.resolved.segments.forEach((segment,segmentIndex)=>{
      if(!segment.layer)return;
      const active=segmentIndex===index;
      const hasActive=index>=0;
      segment.layer.setStyle({weight:active?9.5:6.5,opacity:hasActive?(active?1:.76):1});
      if(active)segment.layer.bringToFront();
    });
    highlightedSegmentIndex=index;
    updateMapLegendCurrentSegment(index);

    document.querySelectorAll('.ctg-waypoint-chip').forEach((chip,chipIndex)=>{
      chip.classList.toggle('current',index>=0&&(chipIndex===index||chipIndex===index+1));
    });
  }

  function updateLiveRouteStatus(position){
    if(!position||liveWatchId===null)return;
    if(!activeRouteView?.resolved?.roadFollowed||!activeRouteView.resolved.segments.length){
      highlightActiveSegment(-1);
      setLiveMessage('Live location active','Select a road-following route to compare your movement. Location stays in this browser and is not stored.','tracking');
      return;
    }

    const point=[position.lat,position.lng];
    let best={distance:Infinity,index:-1,segment:null};
    activeRouteView.resolved.segments.forEach((segment,index)=>{
      const distance=geometryDistanceMeters(point,segment.geometry);
      if(distance<best.distance)best={distance,index,segment};
    });

    const accuracy=Number.isFinite(position.accuracy)?position.accuracy:30;
    const onRouteThreshold=Math.max(45,Math.min(120,accuracy*1.5));
    const nearRouteThreshold=onRouteThreshold+120;
    const state=best.distance<=onRouteThreshold?'on':best.distance<=nearRouteThreshold?'near':'off';

    highlightActiveSegment(state==='off'?-1:best.index);

    const nextDistance=best.segment?haversineMeters(point,best.segment.to.coord):null;
    const section=best.segment?`${best.segment.from.name} → ${best.segment.to.name}`:'Selected route';
    const next=best.segment?`Next: ${best.segment.to.name} ${formatDistance(nextDistance)}`:'';
    const accuracyText=`GPS ±${Math.round(accuracy)} m`;

    if(state==='on'){
      setLiveMessage('On selected route',`${section} · ${next} · ${accuracyText}`,'on');
    }else if(state==='near'){
      setLiveMessage('Near selected route',`${Math.round(best.distance)} m from route · ${section} · ${accuracyText}`,'near');
    }else{
      setLiveMessage('Off selected route',`${Math.round(best.distance)} m from the mapped route · ${accuracyText}`,'off');
    }
  }

  function updateLiveStatusUI(){
    const row=document.querySelector('.ctg-live-status');
    const button=document.querySelector('.ctg-location');
    if(button){
      const active=liveWatchId!==null;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',active?'true':'false');
      button.title=active?'Stop sharing live location':'Share live location';
      button.setAttribute('aria-label',active?'Stop sharing live location':'Share live location');
    }
    if(!row)return;
    if(liveWatchId===null){
      row.hidden=true;
      return;
    }
    row.hidden=false;
    updateLiveFollowButton();
    if(lastReliablePosition)updateLiveRouteStatus(lastReliablePosition);
    else setLiveMessage('Getting a precise GPS fix','Waiting for a reliable phone GPS reading. Weak network-based locations are not plotted.','tracking');
  }

  function pruneGpsSamples(now=Date.now()){
    gpsSamples=gpsSamples.filter(sample=>now-sample.receivedAt<=GPS_SAMPLE_WINDOW_MS);
  }

  function weightedGpsPosition(samples){
    if(!samples.length)return null;
    let latSum=0,lngSum=0,weightSum=0,accuracyWeight=0;
    const now=Date.now();

    for(const sample of samples){
      const recency=Math.max(.25,1-(now-sample.receivedAt)/GPS_SAMPLE_WINDOW_MS);
      const accuracyWeightValue=1/Math.max(25,sample.accuracy)**2;
      const weight=accuracyWeightValue*recency;
      latSum+=sample.lat*weight;
      lngSum+=sample.lng*weight;
      accuracyWeight+=sample.accuracy*weight;
      weightSum+=weight;
    }

    if(weightSum<=0)return samples.at(-1);
    return{
      lat:latSum/weightSum,
      lng:lngSum/weightSum,
      accuracy:Math.max(5,accuracyWeight/weightSum),
      timestamp:samples.at(-1).timestamp,
      receivedAt:now
    };
  }

  function isImplausibleJump(next){
    if(!lastReliablePosition)return false;
    const elapsed=Math.max(.5,(next.timestamp-lastReliablePosition.timestamp)/1000);
    const distance=haversineMeters([lastReliablePosition.lat,lastReliablePosition.lng],[next.lat,next.lng]);
    const allowance=Math.max(
      120,
      GPS_MAX_JUMP_SPEED_MPS*elapsed+(lastReliablePosition.accuracy||0)+(next.accuracy||0)
    );
    if(distance<=allowance)return false;

    // A much more accurate reading is allowed to replace an older bad fix.
    const substantiallyBetter=next.accuracy<Math.max(35,(lastReliablePosition.accuracy||Infinity)*.55);
    return!substantiallyBetter;
  }

  function showWeakGps(accuracy){
    const rounded=Number.isFinite(accuracy)?Math.round(accuracy):null;
    const suffix=rounded?` Current estimate is only ±${rounded} m.`:'';
    setLiveMessage(
      'Waiting for precise GPS',
      `Your phone has not provided a reliable fix yet.${suffix} Turn on Precise Location / GPS, keep Wi-Fi and mobile data available, and move near a window or outdoors.`,
      'near'
    );
  }

  function renderReliablePosition(position){
    lastReliablePosition=position;
    lastLivePosition=position;
    const {lat,lng,accuracy}=position;

    if(!liveMarker){
      liveMarker=L.marker([lat,lng],{icon:liveLocationIcon('tracking'),zIndexOffset:1200}).addTo(liveLayer);
      liveAccuracyCircle=L.circle([lat,lng],{
        radius:Math.max(accuracy,5),
        color:'#2563eb',
        weight:1,
        opacity:.45,
        fillColor:'#2563eb',
        fillOpacity:.08,
        interactive:false
      }).addTo(liveLayer);
    }else{
      liveMarker.setLatLng([lat,lng]);
      liveAccuracyCircle?.setLatLng([lat,lng]).setRadius(Math.max(accuracy,5));
    }

    if(followLiveLocation)map.panTo([lat,lng],{animate:true,duration:.35});
    updateLiveRouteStatus(position);
  }

  function handleLivePosition(geoPosition){
    const {latitude,longitude,accuracy}=geoPosition.coords;
    if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy))return;

    const sample={
      lat:latitude,
      lng:longitude,
      accuracy,
      timestamp:geoPosition.timestamp||Date.now(),
      receivedAt:Date.now()
    };

    pruneGpsSamples(sample.receivedAt);

    // Do not place a precise-looking marker using a coarse cell/Wi-Fi estimate.
    if(accuracy>GPS_MAX_ACCEPTABLE_ACCURACY){
      showWeakGps(accuracy);
      return;
    }

    gpsSamples.push(sample);
    pruneGpsSamples();

    const goodSamples=gpsSamples.filter(item=>item.accuracy<=GPS_TARGET_ACCURACY);
    const candidates=goodSamples.length?goodSamples:gpsSamples;
    const filtered=weightedGpsPosition(candidates);
    if(!filtered)return;

    if(isImplausibleJump(filtered)){
      setLiveMessage(
        'GPS jump ignored',
        `A sudden location jump was rejected (±${Math.round(filtered.accuracy)} m). Waiting for another GPS reading.`,
        'near'
      );
      return;
    }

    const warmupElapsed=Date.now()-gpsWarmupStartedAt;
    const preciseEnough=filtered.accuracy<=GPS_TARGET_ACCURACY;

    if(!preciseEnough&&warmupElapsed<12000&&!lastReliablePosition){
      setLiveMessage(
        'Improving GPS accuracy',
        `Current reading is ±${Math.round(filtered.accuracy)} m. Waiting briefly for a stronger GPS fix before placing your marker.`,
        'tracking'
      );
      return;
    }

    renderReliablePosition(filtered);
  }

  function handleLiveError(error){
    const message=error?.code===1
      ?'Location permission was denied. Enable Precise Location for this browser/site, then try again.'
      :error?.code===2
        ?'Your device cannot determine an accurate location right now. Turn on GPS / Location Services and try outdoors.'
        :'Location timed out before a reliable fix was received. Check GPS and Precise Location, then try again.';
    setLiveMessage('Live location unavailable',message,'off');
    stopLiveLocation({keepMessage:true});
  }

  function startLiveLocation(){
    if(liveWatchId!==null)return;
    if(!navigator.geolocation){
      window.alert('This browser does not support live location.');
      return;
    }

    followLiveLocation=true;
    gpsSamples=[];
    lastLivePosition=null;
    lastReliablePosition=null;
    gpsWarmupStartedAt=Date.now();

    liveWatchId=navigator.geolocation.watchPosition(handleLivePosition,handleLiveError,{
      enableHighAccuracy:true,
      maximumAge:0,
      timeout:20000
    });
    updateLiveStatusUI();
  }

  function stopLiveLocation(options={}){
    if(liveWatchId!==null&&navigator.geolocation)navigator.geolocation.clearWatch(liveWatchId);
    liveWatchId=null;
    lastLivePosition=null;
    lastReliablePosition=null;
    gpsSamples=[];
    gpsWarmupStartedAt=0;
    followLiveLocation=false;
    highlightedSegmentIndex=-1;
    liveLayer?.clearLayers();
    liveMarker=null;
    liveAccuracyCircle=null;
    highlightActiveSegment(-1);

    const row=document.querySelector('.ctg-live-status');
    if(row&&!options.keepMessage)row.hidden=true;
    const button=document.querySelector('.ctg-location');
    if(button){
      button.classList.remove('active');
      button.setAttribute('aria-pressed','false');
      button.title='Share live location';
      button.setAttribute('aria-label','Share live location');
    }
    updateLiveFollowButton();
  }

  function toggleLiveLocation(){
    if(liveWatchId!==null)stopLiveLocation();
    else startLiveLocation();
  }

  function clearFocus(){
    ++focusRequestSerial;
    focusLayer.clearLayers();
    staticPolylineOpacity(false);
    focusedBounds=null;
    focusedRouteId=null;
    focusedTransfer=null;
    activeRouteView=null;
    highlightedSegmentIndex=-1;
    setMapLoading(false);
    setGeometryLabel('Road-following estimate from mapped route points');
    const card=document.querySelector('.map-card');
    if(!card)return;
    card.querySelector('.ctg-trip-summary').hidden=true;
    card.querySelector('.ctg-nav-sheet').hidden=true;
    card.querySelector('.ctg-fit-route').hidden=true;
    card.querySelector('.ctg-direction-switch').hidden=true;
    card.querySelector('.ctg-waypoint-strip').hidden=true;
    renderMapLegendRouteSections(null,null);
    updateMapLegendCurrentSegment(-1);
  }

  function resetOverview(){
    clearFocus();
    map.invalidateSize();
    map.flyToBounds([[10.18,123.74],[10.54,124.03]],{padding:[24,24],maxZoom:12.1,duration:.65});
  }

  function openExistingRouteDialog(id){
    const route=getRoutes().find(item=>item.id===id);
    if(!route)return;
    const card=document.querySelector(`.route-card[data-id="${CSS.escape(id)}"]`);
    if(card){card.click();return;}
    const search=document.getElementById('routeSearch');
    if(search){
      search.value=route.code;
      search.dispatchEvent(new Event('input',{bubbles:true}));
      setTimeout(()=>document.querySelector(`.route-card[data-id="${CSS.escape(id)}"]`)?.click(),0);
    }
  }

  function decorateRouteCards(){
    document.querySelectorAll('.route-card[data-id]').forEach(card=>{
      if(card.querySelector('.ctg-route-map-btn'))return;
      const bottom=card.querySelector('.route-card-bottom');
      if(!bottom)return;
      const button=document.createElement('button');
      button.type='button';
      button.className='ctg-route-map-btn';
      button.textContent='Map';
      button.setAttribute('aria-label','Show road-following route on map');
      button.addEventListener('click',event=>{
        event.stopPropagation();
        showRoute(card.dataset.id,{scroll:true});
      });
      const favorite=bottom.querySelector('.favorite-btn');
      bottom.insertBefore(button,favorite||null);
    });
  }

  function scheduleRouteBookExpansion(){
    clearTimeout(expandTimer);
    expandTimer=setTimeout(expandScrollableRouteBook,20);
  }

  function expandScrollableRouteBook(){
    const button=document.getElementById('loadMoreBtn');
    if(!button||expandingRouteBook)return;
    expandingRouteBook=true;
    let attempts=0;

    const pump=()=>{
      if(!button.hidden&&attempts<20){
        attempts+=1;
        button.click();
        requestAnimationFrame(pump);
        return;
      }
      expandingRouteBook=false;
      button.hidden=true;
      decorateRouteCards();
    };
    pump();
  }

  function resetRouteScroll(){
    const grid=document.getElementById('routeGrid');
    if(grid)grid.scrollTo({top:0,behavior:'smooth'});
  }

  function localPlaceMatch(query){
    const q=normalize(query);
    if(!q)return null;
    const ranked=catalog
      .map(item=>{
        let score=0;
        if(item.key===q)score=100;
        else if(item.key.startsWith(q))score=80;
        else if(q.startsWith(item.key))score=70;
        else if(item.key.includes(q))score=55;
        else if(q.includes(item.key))score=45;
        return{item,score};
      })
      .filter(row=>row.score>0)
      .sort((a,b)=>b.score-a.score);
    const hit=ranked[0]?.item;
    return hit?{label:hit.name,coord:[hit.lat,hit.lng],source:'atlas'}:null;
  }

  function formatPhotonLabel(properties={}){
    const parts=[
      properties.name,
      properties.street,
      properties.district,
      properties.locality,
      properties.city,
      properties.county,
      properties.state
    ].filter(Boolean);
    const seen=new Set();
    return parts.filter(value=>{
      const key=normalize(value);
      if(!key||seen.has(key))return false;
      seen.add(key);
      return true;
    }).slice(0,5).join(', ');
  }

  async function geocodePlace(query,{limit=6,signal}={}){
    const raw=String(query||'').trim();
    if(!raw)return[];

    const local=localPlaceMatch(raw);
    const cacheKey=normalize(raw);
    if(geocodeCache.has(cacheKey)){
      const cached=geocodeCache.get(cacheKey);
      return local?[local,...cached.filter(item=>haversineMeters(local.coord,item.coord)>80)]:cached;
    }

    const params=new URLSearchParams({
      q:`${raw}, Cebu, Philippines`,
      limit:String(limit),
      lang:'en',
      lat:'10.3157',
      lon:'123.8854',
      bbox:CEBU_SEARCH_BBOX
    });

    try{
      const response=await fetch(`${PLACE_SEARCH_URL}?${params.toString()}`,{
        signal,
        credentials:'omit',
        referrerPolicy:'no-referrer'
      });
      if(!response.ok)throw new Error(`Place search returned ${response.status}`);
      const data=await response.json();
      const results=(data?.features||[])
        .map(feature=>{
          const coordinates=feature?.geometry?.coordinates;
          if(!Array.isArray(coordinates)||coordinates.length<2)return null;
          const [lng,lat]=coordinates;
          if(!Number.isFinite(lat)||!Number.isFinite(lng))return null;
          if(lat<9.2||lat>11.6||lng<123.2||lng>124.4)return null;
          const label=formatPhotonLabel(feature.properties)||raw;
          return{
            label,
            coord:[lat,lng],
            source:'photon',
            type:feature.properties?.type||feature.properties?.osm_value||''
          };
        })
        .filter(Boolean);

      const deduped=[];
      const seen=new Set();
      for(const result of results){
        const key=`${normalize(result.label)}|${result.coord[0].toFixed(4)}|${result.coord[1].toFixed(4)}`;
        if(seen.has(key))continue;
        seen.add(key);
        deduped.push(result);
      }
      geocodeCache.set(cacheKey,deduped);
      return local?[local,...deduped.filter(item=>haversineMeters(local.coord,item.coord)>80)]:deduped;
    }catch(error){
      if(error?.name==='AbortError')throw error;
      return local?[local]:[];
    }
  }

  function clearPlaceSelection(input){
    delete input.dataset.ctgLat;
    delete input.dataset.ctgLng;
    delete input.dataset.ctgLabel;
  }

  function setPlaceSelection(input,place){
    input.value=place.label;
    input.dataset.ctgLat=String(place.coord[0]);
    input.dataset.ctgLng=String(place.coord[1]);
    input.dataset.ctgLabel=place.label;
  }

  function selectedPlaceFromInput(input){
    const lat=Number(input.dataset.ctgLat);
    const lng=Number(input.dataset.ctgLng);
    if(Number.isFinite(lat)&&Number.isFinite(lng)&&input.dataset.ctgLabel===input.value){
      return{label:input.dataset.ctgLabel,coord:[lat,lng],source:'selected'};
    }
    return null;
  }

  async function resolveInputPlace(input){
    const selected=selectedPlaceFromInput(input);
    if(selected)return selected;
    const matches=await geocodePlace(input.value,{limit:6});
    if(!matches.length)throw new Error(`Could not locate “${input.value.trim()}” in Cebu.`);
    const place=matches[0];
    setPlaceSelection(input,place);
    return place;
  }

  function setupPlaceAutocomplete(input){
    if(!input||input.dataset.ctgAutocomplete==='ready')return;
    input.dataset.ctgAutocomplete='ready';
    input.autocomplete='off';

    const parent=input.parentElement;
    if(!parent)return;
    parent.classList.add('ctg-place-field');

    const box=document.createElement('div');
    box.className='ctg-place-suggestions';
    box.hidden=true;
    parent.append(box);

    let timer=null;
    let querySerial=0;

    const hide=()=>{box.hidden=true;};

    const render=places=>{
      box.replaceChildren();
      if(!places.length){
        hide();
        return;
      }

      places.forEach(place=>{
        const button=document.createElement('button');
        button.type='button';
        button.className='ctg-place-suggestion';
        const icon=document.createElement('span');
        icon.className='ctg-place-suggestion-icon';
        icon.textContent='⌖';
        const copy=document.createElement('span');
        const strong=document.createElement('strong');
        strong.textContent=place.label.split(',')[0]||place.label;
        const small=document.createElement('small');
        small.textContent=place.label;
        copy.append(strong,small);
        button.append(icon,copy);
        button.addEventListener('pointerdown',event=>{
          event.preventDefault();
          setPlaceSelection(input,place);
          hide();
          input.dispatchEvent(new Event('change',{bubbles:true}));
        });
        box.append(button);
      });
      box.hidden=false;
    };

    input.addEventListener('input',()=>{
      clearPlaceSelection(input);
      clearTimeout(timer);
      const query=input.value.trim();
      if(query.length<2){
        hide();
        return;
      }

      timer=setTimeout(async()=>{
        const serial=++querySerial;
        const previous=geocodeControllers.get(input);
        previous?.abort();
        const controller=new AbortController();
        geocodeControllers.set(input,controller);

        try{
          const places=await geocodePlace(query,{limit:6,signal:controller.signal});
          if(serial!==querySerial||input.value.trim()!==query)return;
          render(places);
        }catch(error){
          if(error?.name!=='AbortError')hide();
        }
      },260);
    });

    input.addEventListener('focus',()=>{
      const selected=selectedPlaceFromInput(input);
      if(!selected&&input.value.trim().length>=2)input.dispatchEvent(new Event('input',{bubbles:false}));
    });
    input.addEventListener('blur',()=>setTimeout(hide,140));
    input.addEventListener('keydown',event=>{
      if(event.key==='Enter'){
        event.preventDefault();
        hide();
        runSpatialPlanner();
      }else if(event.key==='Escape'){
        hide();
      }
    });
  }

  function buildSpatialRouteIndex(){
    if(spatialRouteIndex)return spatialRouteIndex;
    const entries=[];
    for(const route of getRoutes()){
      for(const direction of ['forward','reverse']){
        const info=routeWaypoints(route,{direction});
        const points=info.waypoints.map(item=>item.coord);
        if(points.length<2)continue;
        entries.push({
          route,
          direction,
          profile:info.profile,
          waypoints:info.waypoints,
          points
        });
      }
    }
    spatialRouteIndex=entries;
    return entries;
  }

  function scheduleSpatialIndex(){
    if(spatialRouteIndex||spatialIndexPromise)return;
    spatialIndexPromise=new Promise(resolve=>{
      const build=()=>{
        try{resolve(buildSpatialRouteIndex());}
        finally{spatialIndexPromise=null;}
      };
      if('requestIdleCallback' in window)requestIdleCallback(build,{timeout:1400});
      else setTimeout(build,180);
    });
  }

  function projectPointToSegmentInfo(point,a,b){
    const refLat=toRadians((point[0]+a[0]+b[0])/3);
    const metersPerLat=111320;
    const metersPerLng=111320*Math.cos(refLat);
    const px=(point[1]-a[1])*metersPerLng;
    const py=(point[0]-a[0])*metersPerLat;
    const bx=(b[1]-a[1])*metersPerLng;
    const by=(b[0]-a[0])*metersPerLat;
    const lengthSquared=bx*bx+by*by;
    const t=lengthSquared===0?0:Math.max(0,Math.min(1,(px*bx+py*by)/lengthSquared));
    const coord=[
      a[0]+(b[0]-a[0])*t,
      a[1]+(b[1]-a[1])*t
    ];
    return{
      t,
      coord,
      distance:haversineMeters(point,coord)
    };
  }

  function nearestProjectionOnPolyline(point,points){
    if(!points?.length)return{distance:Infinity,coord:point,progress:0,segmentIndex:0};
    if(points.length===1)return{distance:haversineMeters(point,points[0]),coord:points[0],progress:0,segmentIndex:0};

    const lengths=[];
    let total=0;
    for(let i=0;i<points.length-1;i++){
      const length=haversineMeters(points[i],points[i+1]);
      lengths.push(length);
      total+=length;
    }

    let cumulative=0;
    let best={distance:Infinity,coord:points[0],progress:0,segmentIndex:0,t:0};
    for(let i=0;i<points.length-1;i++){
      const projected=projectPointToSegmentInfo(point,points[i],points[i+1]);
      if(projected.distance<best.distance){
        best={
          ...projected,
          segmentIndex:i,
          progress:total>0?(cumulative+projected.t*lengths[i])/total:0
        };
      }
      cumulative+=lengths[i];
    }
    return best;
  }

  function samplePolyline(points){
    if(points.length<2)return[];
    const segmentLengths=points.slice(0,-1).map((point,index)=>haversineMeters(point,points[index+1]));
    const total=segmentLengths.reduce((sum,value)=>sum+value,0)||1;
    const samples=[];
    let cumulative=0;
    points.slice(0,-1).forEach((point,index)=>{
      const next=points[index+1];
      const length=segmentLengths[index];
      const divisions=Math.max(1,Math.min(4,Math.ceil(length/650)));
      for(let step=0;step<divisions;step++){
        const t=step/divisions;
        samples.push({
          coord:[point[0]+(next[0]-point[0])*t,point[1]+(next[1]-point[1])*t],
          progress:(cumulative+length*t)/total
        });
      }
      cumulative+=length;
    });
    samples.push({coord:points.at(-1),progress:1});
    return samples;
  }

  function closestPolylineConnection(aPoints,bPoints){
    let best={distance:Infinity,aCoord:null,bCoord:null,progressA:0,progressB:0};

    for(const sample of samplePolyline(aPoints)){
      const projected=nearestProjectionOnPolyline(sample.coord,bPoints);
      if(projected.distance<best.distance){
        best={
          distance:projected.distance,
          aCoord:sample.coord,
          bCoord:projected.coord,
          progressA:sample.progress,
          progressB:projected.progress
        };
      }
    }

    for(const sample of samplePolyline(bPoints)){
      const projected=nearestProjectionOnPolyline(sample.coord,aPoints);
      if(projected.distance<best.distance){
        best={
          distance:projected.distance,
          aCoord:projected.coord,
          bCoord:sample.coord,
          progressA:projected.progress,
          progressB:sample.progress
        };
      }
    }
    return best;
  }

  function nearestWaypointName(entry,coord){
    let best={distance:Infinity,name:entry.route.code};
    entry.waypoints.forEach(waypoint=>{
      const distance=haversineMeters(coord,waypoint.coord);
      if(distance<best.distance)best={distance,name:waypoint.name};
    });
    return best.name;
  }

  function nearestCatalogName(coord,maxMeters=850){
    let best={distance:Infinity,name:''};
    catalog.forEach(item=>{
      const distance=haversineMeters(coord,[item.lat,item.lng]);
      if(distance<best.distance)best={distance,name:item.name};
    });
    return best.distance<=maxMeters?best.name:'transfer point';
  }

  function findSpatialItineraries(origin,destination){
    const entries=buildSpatialRouteIndex();
    const prepared=entries.map(entry=>({
      ...entry,
      originProjection:nearestProjectionOnPolyline(origin.coord,entry.points),
      destinationProjection:nearestProjectionOnPolyline(destination.coord,entry.points)
    }));

    const direct=[];
    for(const entry of prepared){
      const board=entry.originProjection;
      const drop=entry.destinationProjection;
      if(board.distance>SPATIAL_BOARD_MAX_METERS||drop.distance>SPATIAL_DROP_MAX_METERS)continue;
      if(drop.progress<=board.progress+.025)continue;
      direct.push({
        rides:1,
        entry,
        board,
        drop,
        boardName:nearestWaypointName(entry,board.coord),
        dropName:nearestWaypointName(entry,drop.coord),
        score:board.distance*1.12+drop.distance*1.2+220
      });
    }

    const firstLegs=prepared
      .filter(entry=>entry.originProjection.distance<=SPATIAL_BOARD_MAX_METERS&&entry.originProjection.progress<.94)
      .sort((a,b)=>a.originProjection.distance-b.originProjection.distance)
      .slice(0,24);
    const secondLegs=prepared
      .filter(entry=>entry.destinationProjection.distance<=SPATIAL_DROP_MAX_METERS&&entry.destinationProjection.progress>.06)
      .sort((a,b)=>a.destinationProjection.distance-b.destinationProjection.distance)
      .slice(0,28);

    const transfers=[];
    const seen=new Set();
    for(const first of firstLegs){
      for(const second of secondLegs){
        if(first.route.id===second.route.id)continue;
        const key=`${first.route.id}|${first.direction}>${second.route.id}|${second.direction}`;
        if(seen.has(key))continue;
        seen.add(key);

        const connection=closestPolylineConnection(first.points,second.points);
        if(connection.distance>SPATIAL_TRANSFER_MAX_METERS)continue;
        if(connection.progressA<=first.originProjection.progress+.025)continue;
        if(second.destinationProjection.progress<=connection.progressB+.025)continue;

        const transferMid=[
          (connection.aCoord[0]+connection.bCoord[0])/2,
          (connection.aCoord[1]+connection.bCoord[1])/2
        ];
        transfers.push({
          rides:2,
          first,
          second,
          connection,
          board:first.originProjection,
          drop:second.destinationProjection,
          boardName:nearestWaypointName(first,first.originProjection.coord),
          dropName:nearestWaypointName(second,second.destinationProjection.coord),
          transferName:nearestCatalogName(transferMid),
          score:first.originProjection.distance*1.1+
            second.destinationProjection.distance*1.2+
            connection.distance*1.65+860
        });
      }
    }

    const combined=[...direct.sort((a,b)=>a.score-b.score).slice(0,8),...transfers.sort((a,b)=>a.score-b.score).slice(0,12)]
      .sort((a,b)=>a.score-b.score);

    const routeKeys=new Set();
    return combined.filter(item=>{
      const key=item.rides===1
        ?`1|${item.entry.route.id}|${item.entry.direction}`
        :`2|${item.first.route.id}|${item.first.direction}|${item.second.route.id}|${item.second.direction}`;
      if(routeKeys.has(key))return false;
      routeKeys.add(key);
      return true;
    }).slice(0,7);
  }

  function routeModeLabel(route){
    return labelFor(route.mode)||'Public transport';
  }

  function createWalkText(meters){
    if(meters<80)return'nearby';
    return `${formatDistance(meters)} walk`;
  }

  function renderSpatialPlanner(plan){
    const host=document.getElementById('plannerResults');
    if(!host)return;
    host.classList.add('show');
    host.replaceChildren();

    const summary=document.createElement('div');
    summary.className='ctg-spatial-summary';
    const summaryStrong=document.createElement('strong');
    summaryStrong.textContent=`${plan.origin.label} → ${plan.destination.label}`;
    const summarySmall=document.createElement('small');
    summarySmall.textContent='Live Cebu place search + route proximity. Walking distances are approximate.';
    summary.append(summaryStrong,summarySmall);
    host.append(summary);

    if(!plan.itineraries.length){
      const empty=document.createElement('div');
      empty.className='ctg-spatial-empty';
      const title=document.createElement('strong');
      title.textContent='No reliable 1- or 2-ride match found';
      const copy=document.createElement('p');
      copy.textContent='Try a nearby landmark, terminal, barangay, or street. The planner will not invent a route when the mapped network does not support one.';
      empty.append(title,copy);
      host.append(empty);
      return;
    }

    plan.itineraries.forEach((itinerary,index)=>{
      const card=document.createElement('article');
      card.className='ctg-spatial-result';
      if(index===0)card.classList.add('best');

      const top=document.createElement('div');
      top.className='ctg-spatial-result-top';
      const badge=document.createElement('span');
      badge.className='ctg-spatial-ride-count';
      badge.textContent=itinerary.rides===1
        ?(itinerary.drop.distance>1200?'1 ride + local':'1 ride')
        :'2 rides';
      const title=document.createElement('strong');
      if(itinerary.rides===1){
        title.textContent=`${itinerary.entry.route.code} · ${routeModeLabel(itinerary.entry.route)}`;
      }else{
        title.textContent=`${itinerary.first.route.code} → ${itinerary.second.route.code}`;
      }
      top.append(badge,title);
      if(index===0){
        const best=document.createElement('span');
        best.className='ctg-spatial-best';
        best.textContent='Best match';
        top.append(best);
      }

      const steps=document.createElement('div');
      steps.className='ctg-spatial-steps';

      const addStep=(kind,heading,detail)=>{
        const row=document.createElement('div');
        row.className=`ctg-spatial-step ${kind}`;
        const dot=document.createElement('span');
        const copy=document.createElement('div');
        const strong=document.createElement('strong');
        strong.textContent=heading;
        const small=document.createElement('small');
        small.textContent=detail;
        copy.append(strong,small);
        row.append(dot,copy);
        steps.append(row);
      };

      if(itinerary.rides===1){
        addStep('walk',`Go to ${itinerary.boardName}`,createWalkText(itinerary.board.distance));
        addStep('ride',`Ride ${itinerary.entry.route.code} ${itinerary.entry.direction==='reverse'?'return':'outbound'}`,itinerary.entry.profile.label||itinerary.entry.route.corridor);
        addStep(
          'drop',
          `Drop near ${itinerary.dropName}`,
          itinerary.drop.distance>1200
            ?`${formatDistance(itinerary.drop.distance)} remaining — use a local feeder/tricycle/walk if available`
            :`${createWalkText(itinerary.drop.distance)} to destination`
        );
      }else{
        addStep('walk',`Go to ${itinerary.boardName}`,createWalkText(itinerary.first.originProjection.distance));
        addStep('ride',`Ride ${itinerary.first.route.code}`,itinerary.first.profile.label||itinerary.first.route.corridor);
        addStep('transfer',`Transfer near ${itinerary.transferName}`,itinerary.connection.distance<80?'routes meet nearby':`${formatDistance(itinerary.connection.distance)} between routes`);
        addStep('ride',`Then ride ${itinerary.second.route.code}`,itinerary.second.profile.label||itinerary.second.route.corridor);
        addStep('drop',`Drop near ${itinerary.dropName}`,`${createWalkText(itinerary.second.destinationProjection.distance)} to destination`);
      }

      const actions=document.createElement('div');
      actions.className='ctg-spatial-actions';
      const mapButton=document.createElement('button');
      mapButton.type='button';
      mapButton.className='primary-btn compact';
      mapButton.textContent='Show on map';
      mapButton.addEventListener('click',()=>showSpatialItinerary(itinerary,plan,{scroll:true}));
      actions.append(mapButton);

      card.append(top,steps,actions);
      host.append(card);
    });
  }

  function renderPlannerLoading(from,to){
    const host=document.getElementById('plannerResults');
    if(!host)return;
    host.classList.add('show');
    host.replaceChildren();
    const loading=document.createElement('div');
    loading.className='ctg-spatial-loading';
    const spinner=document.createElement('span');
    const copy=document.createElement('div');
    const strong=document.createElement('strong');
    strong.textContent='Finding the best Cebu route…';
    const small=document.createElement('small');
    small.textContent=`Matching “${from}” to “${to}” against the mapped transport network.`;
    copy.append(strong,small);
    loading.append(spinner,copy);
    host.append(loading);
  }

  function renderPlannerError(message){
    const host=document.getElementById('plannerResults');
    if(!host)return;
    host.classList.add('show');
    host.replaceChildren();
    const box=document.createElement('div');
    box.className='ctg-spatial-empty error';
    const title=document.createElement('strong');
    title.textContent='Could not complete that place search';
    const copy=document.createElement('p');
    copy.textContent=message;
    box.append(title,copy);
    host.append(box);
  }

  function geometrySliceForTrip(geometry,startProjection,endProjection){
    if(!geometry?.length)return[];
    const start=Math.max(0,Math.min(geometry.length-2,startProjection.segmentIndex||0));
    const end=Math.max(start+1,Math.min(geometry.length-1,(endProjection.segmentIndex||start)+1));
    return[
      startProjection.coord,
      ...geometry.slice(start+1,end),
      endProjection.coord
    ];
  }

  function drawWalkingConnector(fromCoord,toCoord,label){
    const distance=haversineMeters(fromCoord,toCoord);
    if(distance<35)return;
    L.polyline([fromCoord,toCoord],{
      color:'#64748b',
      weight:3,
      opacity:.82,
      dashArray:'6 7',
      lineCap:'round',
      interactive:true
    }).bindTooltip(`${label} · ${formatDistance(distance)}`,{
      className:'ctg-route-tooltip',
      sticky:true
    }).addTo(focusLayer);
  }

  function addWaitDropMarker(kind,coord,name){
    const wait=kind==='wait';
    L.marker(coord,{
      icon:boardDropIcon(wait?'wait':'drop',wait?'WAIT HERE':'DROP HERE'),
      zIndexOffset:1200
    }).bindTooltip(`${wait?'Wait here':'Drop here'} · ${name}`,{
      direction:'top',
      className:'ctg-route-tooltip'
    }).addTo(focusLayer);
  }

  async function showSpatialDirect(itinerary,plan,{scroll=true}={}){
    const route=itinerary.entry.route;
    const serial=++focusRequestSerial;
    focusLayer.clearLayers();
    staticPolylineOpacity(true);
    focusedRouteId=route.id;
    focusedTransfer=null;
    focusedBounds=null;
    highlightedSegmentIndex=-1;

    updateSheet({
      route,
      title:`${route.code} · ${plan.origin.label} → ${plan.destination.label}`,
      subtitle:'Matching boarding and drop points to the road-following route…',
      color:colorFor(route.mode),
      loading:true
    });

    const resolved=await resolveRoutePath(route,{direction:itinerary.entry.direction});
    if(serial!==focusRequestSerial)return;
    const board=nearestProjectionOnPolyline(plan.origin.coord,resolved.geometry);
    const drop=nearestProjectionOnPolyline(plan.destination.coord,resolved.geometry);

    focusLayer.clearLayers();
    drawResolvedRoute(route,resolved,colorFor(route.mode),{
      waitCoord:board.coord,
      dropCoord:drop.coord,
      waitName:itinerary.boardName,
      dropName:itinerary.dropName
    });
    drawWalkingConnector(plan.origin.coord,board.coord,'Walk to boarding point');
    drawWalkingConnector(drop.coord,plan.destination.coord,'Walk to destination');

    const rideSlice=geometrySliceForTrip(resolved.geometry,board,drop);
    const boundsPoints=[...rideSlice,plan.origin.coord,plan.destination.coord];
    focusedBounds=L.latLngBounds(boundsPoints);
    activeRouteView={route,resolved,direction:itinerary.entry.direction,from:plan.origin.label,to:plan.destination.label};

    updateSheet({
      route,
      resolved,
      title:`${route.code} · ${plan.origin.label} → ${plan.destination.label}`,
      subtitle:`Wait near ${itinerary.boardName} · drop near ${itinerary.dropName} · ${createWalkText(board.distance+drop.distance)} total walking`,
      color:colorFor(route.mode)
    });
    setGeometryLabel('Red = recommended boarding · green = recommended drop-off · dashed gray = walking connection');
    fitFocused();
    if(scroll)document.getElementById('map-section')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  async function showSpatialTransfer(itinerary,plan,{scroll=true}={}){
    const serial=++focusRequestSerial;
    focusLayer.clearLayers();
    staticPolylineOpacity(true);
    focusedRouteId=null;
    focusedTransfer={spatial:true};
    focusedBounds=null;
    activeRouteView=null;
    highlightedSegmentIndex=-1;

    updateSheet({
      transfer:itinerary.transferName,
      title:`${itinerary.first.route.code} → ${itinerary.second.route.code}`,
      subtitle:'Matching both rides and transfer point to the road network…',
      color:'#7c4dff',
      loading:true
    });

    const [firstResolved,secondResolved]=await Promise.all([
      resolveRoutePath(itinerary.first.route,{direction:itinerary.first.direction}),
      resolveRoutePath(itinerary.second.route,{direction:itinerary.second.direction})
    ]);
    if(serial!==focusRequestSerial)return;

    const board=nearestProjectionOnPolyline(plan.origin.coord,firstResolved.geometry);
    const transferA=nearestProjectionOnPolyline(itinerary.connection.aCoord,firstResolved.geometry);
    const transferB=nearestProjectionOnPolyline(itinerary.connection.bCoord,secondResolved.geometry);
    const drop=nearestProjectionOnPolyline(plan.destination.coord,secondResolved.geometry);

    focusLayer.clearLayers();
    drawResolvedRoute(itinerary.first.route,firstResolved,colorFor(itinerary.first.route.mode),{skipPins:true});
    drawResolvedRoute(itinerary.second.route,secondResolved,colorFor(itinerary.second.route.mode),{skipPins:true});
    addWaitDropMarker('wait',board.coord,itinerary.boardName);
    addWaitDropMarker('drop',drop.coord,itinerary.dropName);

    const transferMid=[
      (transferA.coord[0]+transferB.coord[0])/2,
      (transferA.coord[1]+transferB.coord[1])/2
    ];
    L.marker(transferMid,{icon:pinIcon('transfer','↻'),zIndexOffset:1150})
      .bindTooltip(`Transfer near ${itinerary.transferName}`,{direction:'top',className:'ctg-route-tooltip'})
      .addTo(focusLayer);

    drawWalkingConnector(plan.origin.coord,board.coord,'Walk to first ride');
    drawWalkingConnector(transferA.coord,transferB.coord,'Transfer walk');
    drawWalkingConnector(drop.coord,plan.destination.coord,'Walk to destination');

    const firstSlice=geometrySliceForTrip(firstResolved.geometry,board,transferA);
    const secondSlice=geometrySliceForTrip(secondResolved.geometry,transferB,drop);
    focusedBounds=L.latLngBounds([...firstSlice,...secondSlice,plan.origin.coord,plan.destination.coord]);

    updateSheet({
      transfer:itinerary.transferName,
      title:`${itinerary.first.route.code} → ${itinerary.second.route.code}`,
      subtitle:`Wait near ${itinerary.boardName} · transfer near ${itinerary.transferName} · drop near ${itinerary.dropName}`,
      color:'#7c4dff',
      loading:false,
      allowDirection:false
    });
    setGeometryLabel('Red = board · purple = transfer · green = drop · dashed gray = walking connection');
    fitFocused();
    if(scroll)document.getElementById('map-section')?.scrollIntoView({behavior:'smooth',block:'start'});
  }

  function showSpatialItinerary(itinerary,plan,options={}){
    return itinerary.rides===1
      ?showSpatialDirect(itinerary,plan,options)
      :showSpatialTransfer(itinerary,plan,options);
  }

  async function runSpatialPlanner(){
    const fromInput=document.getElementById('fromInput');
    const toInput=document.getElementById('toInput');
    if(!fromInput||!toInput)return;
    const from=fromInput.value.trim();
    const to=toInput.value.trim();
    if(!from||!to){
      renderPlannerError('Enter both an origin and destination.');
      return;
    }

    const serial=++spatialPlannerSerial;
    renderPlannerLoading(from,to);

    try{
      const [origin,destination]=await Promise.all([
        resolveInputPlace(fromInput),
        resolveInputPlace(toInput)
      ]);
      if(serial!==spatialPlannerSerial)return;

      const itineraries=findSpatialItineraries(origin,destination);
      const plan={origin,destination,itineraries};
      activeSpatialPlan=plan;
      renderSpatialPlanner(plan);

      if(itineraries.length){
        showSpatialItinerary(itineraries[0],plan,{scroll:false});
      }else{
        clearFocus();
      }
    }catch(error){
      if(serial!==spatialPlannerSerial)return;
      renderPlannerError(error?.message||'Place search failed. Try a nearby landmark or barangay.');
    }
  }

  function currentPlan(){
    const from=document.getElementById('fromInput')?.value.trim()||'';
    const to=document.getElementById('toInput')?.value.trim()||'';
    if(!from||!to)return{from,to,direct:[],transfers:[]};
    const routes=getRoutes();
    const direct=routes.filter(route=>routeHas(route,from)&&routeHas(route,to));
    const transfers=[];
    if(!direct.length){
      const first=routes.filter(route=>routeHas(route,from));
      const second=routes.filter(route=>routeHas(route,to));
      outer:for(const a of first){
        for(const b of second){
          if(a.id===b.id)continue;
          const common=a.stops.find(sa=>b.stops.some(sb=>exactish(sa,sb)));
          if(common){
            transfers.push({a,b,common});
            if(transfers.length>=4)break outer;
          }
        }
      }
    }
    return{from,to,direct,transfers};
  }

  function decoratePlanner(){
    const rows=[...document.querySelectorAll('#plannerResults .result-route')];
    if(!rows.length)return;
    const plan=currentPlan();

    rows.forEach((row,index)=>{
      if(row.querySelector('.ctg-result-map-btn'))return;
      const button=document.createElement('button');
      button.type='button';
      button.className='ctg-result-map-btn';
      button.textContent='Map';
      button.addEventListener('click',event=>{
        event.stopPropagation();
        if(plan.direct[index])showRoute(plan.direct[index].id,{scroll:true,from:plan.from,to:plan.to});
        else if(plan.transfers[index]){
          const t=plan.transfers[index];
          showTransfer(t.a.id,t.b.id,t.common,{scroll:true,from:plan.from,to:plan.to});
        }
      });

      const details=row.querySelector(':scope > button.text-btn');
      if(details){
        const actions=document.createElement('div');
        actions.className='ctg-result-actions';
        details.before(actions);
        actions.append(button,details);
      }else{
        const lastPill=row.querySelector(':scope > .route-code-pill:last-child');
        const actions=document.createElement('div');
        actions.className='ctg-result-actions';
        if(lastPill){lastPill.before(actions);actions.append(button,lastPill);}
        else row.append(button);
      }
    });
  }

  function decorateDialog(){
    const content=document.getElementById('routeDialogContent');
    if(!content||content.querySelector('.ctg-detail-map-action'))return;
    const code=content.querySelector('.detail-code')?.textContent.trim();
    if(!code)return;
    const route=getRoutes().find(item=>normalize(item.code)===normalize(code));
    if(!route)return;
    const target=content.querySelector('.detail-content');
    if(!target)return;

    const wrap=document.createElement('div');
    wrap.className='ctg-detail-map-action';
    wrap.innerHTML='<button class="primary-btn" type="button">Show road-following route →</button>';
    wrap.querySelector('button').addEventListener('click',event=>{
      event.stopPropagation();
      document.getElementById('routeDialog')?.close();
      history.replaceState(null,'',location.pathname);
      showRoute(route.id,{scroll:true});
    });
    target.append(wrap);
  }

  function autoPreviewPlan(){
    const plan=currentPlan();
    if(plan.direct.length)showRoute(plan.direct[0].id,{scroll:false,from:plan.from,to:plan.to});
    else if(plan.transfers.length){
      const t=plan.transfers[0];
      showTransfer(t.a.id,t.b.id,t.common,{scroll:false,from:plan.from,to:plan.to});
    }else clearFocus();
  }

  function observeDynamicUI(){
    const observer=new MutationObserver(()=>{
      decorateRouteCards();
      decoratePlanner();
      decorateDialog();
      scheduleRouteBookExpansion();
    });

    ['routeGrid','plannerResults','routeDialogContent'].forEach(id=>{
      const node=document.getElementById(id);
      if(node)observer.observe(node,{childList:true,subtree:true});
    });

    decorateRouteCards();
    decoratePlanner();
    decorateDialog();
    scheduleRouteBookExpansion();

    const fromInput=document.getElementById('fromInput');
    const toInput=document.getElementById('toInput');
    setupPlaceAutocomplete(fromInput);
    setupPlaceAutocomplete(toInput);
    scheduleSpatialIndex();

    document.getElementById('findRouteBtn')?.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      runSpatialPlanner();
    },true);

    document.querySelectorAll('.quick-chip').forEach(button=>button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopImmediatePropagation();
      fromInput.value=button.dataset.from||'';
      toInput.value=button.dataset.to||'';
      clearPlaceSelection(fromInput);
      clearPlaceSelection(toInput);
      runSpatialPlanner();
    },true));

    document.getElementById('swapBtn')?.addEventListener('click',()=>{
      clearPlaceSelection(fromInput);
      clearPlaceSelection(toInput);
    });

    document.getElementById('routeSearch')?.addEventListener('input',()=>setTimeout(resetRouteScroll,0));
    document.getElementById('regionFilter')?.addEventListener('change',()=>setTimeout(resetRouteScroll,0));
    document.getElementById('modeTabs')?.addEventListener('click',event=>{
      if(event.target.closest('.mode-tab'))setTimeout(resetRouteScroll,0);
    });
  }

  function start(){
    map=window.__cebuTransportMap;
    if(!map||!window.L)return;
    catalog=coordCatalog();
    focusLayer=L.layerGroup().addTo(map);
    liveLayer=L.layerGroup().addTo(map);
    L.control.scale({metric:true,imperial:false,maxWidth:110,position:'bottomleft'}).addTo(map);
    createMapChrome();
    map.on('dragstart',()=>{
      if(liveWatchId!==null){
        followLiveLocation=false;
        updateLiveFollowButton();
      }
    });
    observeDynamicUI();
    setTimeout(()=>map.invalidateSize(),100);
  }

  if(window.__cebuTransportMap)start();
  else window.addEventListener('cebu-map-ready',start,{once:true});
})();
