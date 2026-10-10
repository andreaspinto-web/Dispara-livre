(() => {
  'use strict';

  // Extensão das camadas simuladas da zona-piloto; o GPS pode centrar o mapa fora desta área.
  const GEO = {west:-9.20, east:-8.84, north:39.32, south:39.02};
  // Enquadramento inicial fixo; o GPS só é pedido após toque no botão principal.
  const start = [39.155, -9.065];
  const huntRing = [[-9.19,39.12],[-9.15,39.24],[-9.08,39.29],[-8.98,39.27],[-8.91,39.22],[-8.88,39.15],[-8.96,39.10],[-9.08,39.10],[-9.19,39.12]];
  const parkRing = [[-9.13,39.17],[-9.10,39.24],[-9.04,39.27],[-8.98,39.25],[-8.96,39.20],[-9.00,39.16],[-9.07,39.15],[-9.13,39.17]];
  const sensitivePlaces = [
    {name:'Vila Verde dos Francos', center:[-9.075,39.205], radius:630},
    {name:'Abrigada', center:[-8.976,39.151], radius:480},
    {name:'Cabanas de Torres', center:[-9.156,39.179], radius:390},
    {name:'Olhalvo', center:[-9.111,39.155], radius:320},
    {name:'Aldeias da serra', center:[-9.035,39.253], radius:350}
  ];
  const boundaryLines = [
    [[39.30,-9.10],[39.25,-9.08],[39.20,-9.04],[39.15,-9.00],[39.08,-8.98]],
    [[39.28,-9.18],[39.24,-9.10],[39.18,-9.03],[39.12,-8.91]],
    [[39.13,-9.18],[39.17,-9.08],[39.20,-9.00],[39.23,-8.84]]
  ];
  const layers = {};
  const fallback = document.getElementById('map-fallback');
  let map, marker, bufferCircle, currentAnalysis = null, manualSelectionActive = false;

  function toSvg([lon, lat]) {
    return [(lon-GEO.west)/(GEO.east-GEO.west)*1000, (GEO.north-lat)/(GEO.north-GEO.south)*700];
  }
  function ringPath(ring) {
    return ring.map((coord,i)=>{const [x,y]=toSvg(coord);return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ')+' Z';
  }
  function drawFallbackLayers() {
    document.getElementById('fb-hunt').setAttribute('d',ringPath(huntRing));
    document.getElementById('fb-park').setAttribute('d',ringPath(parkRing));
    const sens=document.getElementById('fb-sensitive'); sens.replaceChildren();
    sensitivePlaces.forEach(place=>{const [x,y]=toSvg(place.center);const r=place.radius*1000/(111320*Math.cos(place.center[1]*Math.PI/180)*(GEO.east-GEO.west));const c=document.createElementNS('http://www.w3.org/2000/svg','circle');c.setAttribute('cx',x);c.setAttribute('cy',y);c.setAttribute('r',r);c.setAttribute('fill','#e66d5e');c.setAttribute('fill-opacity','.42');c.setAttribute('stroke','#c94e43');c.setAttribute('stroke-width','3');sens.append(c);});
    document.querySelectorAll('[data-layer]').forEach(input=>setFallbackLayer(input.dataset.layer,input.checked));
  }
  function setFallbackLayer(name, visible) {
    const group=fallback.querySelector(`[data-layer-view="${name}"]`);
    if(group) group.style.display=visible?'':'none';
  }
  function pointInRing(point, ring) {
    const [x,y]=point; let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [xi,yi]=ring[i], [xj,yj]=ring[j];
      if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi)) inside=!inside;
    }
    return inside;
  }
  function distanceMeters(a,b) {
    const rad=Math.PI/180, dLat=(b[1]-a[1])*rad, dLon=(b[0]-a[0])*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2;
    return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
  }
  function initMap() {
    drawFallbackLayers();
    const Leaflet=window.L;
    if(!Leaflet || new URLSearchParams(location.search).get('map')==='local') {
      activateFallback();
      return;
    }
    const street=Leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'});
    const satellite=Leaflet.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:18,attribution:'Imagem © <a href="https://www.esri.com/">Esri</a>'});
    let activeBase='satellite';
    try {
      map=Leaflet.map('map',{zoomControl:false,scrollWheelZoom:false,zoomSnap:.5}).setView(start,13);
      satellite.addTo(map);
      Leaflet.control.zoom({position:'bottomright'}).addTo(map);
      layers.hunt=Leaflet.polygon(huntRing.map(([lng,lat])=>[lat,lng]),{color:'#347345',weight:2,fillColor:'#69a96d',fillOpacity:.32}).addTo(map);
      layers.park=Leaflet.polygon(parkRing.map(([lng,lat])=>[lat,lng]),{color:'#cc8c27',weight:2,fillColor:'#edb744',fillOpacity:.31}).addTo(map);
      layers.sensitive=Leaflet.layerGroup(sensitivePlaces.map(place=>Leaflet.circle([place.center[1],place.center[0]],{radius:place.radius,color:'#c94e43',weight:1.5,fillColor:'#e66d5e',fillOpacity:.34}))).addTo(map);
      layers.boundaries=Leaflet.layerGroup(boundaryLines.map(coords=>Leaflet.polyline(coords,{color:'#777e75',weight:1,dashArray:'4 5',opacity:.65}))).addTo(map);
      layers.buffer=Leaflet.layerGroup().addTo(map);
      map.on('click',event=>{
        manualSelectionActive=false;
        document.getElementById('manual-point').classList.remove('active');
        analyze({lat:event.latlng.lat,lng:event.latlng.lng},'manual');
      });
      document.getElementById('map').classList.add('leaflet-ready');
      map.whenReady(()=>setTimeout(()=>map.invalidateSize(),120));
      const mapWrap=document.querySelector('.map-wrap');
      const watchTiles=layer=>{
        layer.on('tileerror',()=>{if(activeBase==='satellite'&&layer===satellite)mapWrap.classList.add('tiles-unavailable');});
        layer.on('tileload',()=>mapWrap.classList.remove('tiles-unavailable'));
      };
      watchTiles(street);watchTiles(satellite);
      document.querySelectorAll('[data-base]').forEach(button=>button.addEventListener('click',()=>{
        activeBase=button.dataset.base;
        document.querySelectorAll('[data-base]').forEach(el=>el.classList.toggle('active',el===button));
        mapWrap.classList.remove('tiles-unavailable');
        if(activeBase==='satellite'){map.removeLayer(street);satellite.addTo(map);document.getElementById('map-credit').textContent='Imagem aérea Esri · Camadas de demonstração';}
        else{map.removeLayer(satellite);street.addTo(map);document.getElementById('map-credit').textContent='© OpenStreetMap · Camadas de demonstração';}
      }));
    } catch(error) {
      activateFallback();
    }
    wireCommonControls();
  }
  function activateFallback() {
    document.getElementById('map').hidden=true;
    document.querySelector('.map-wrap').classList.add('fallback-active');
    document.getElementById('map-credit').textContent='Base esquemática · camadas de demonstração';
    document.querySelector('[data-base="satellite"]').disabled=true;
    document.querySelector('[data-base="satellite"]').title='Disponível quando o mapa online estiver carregado';
    document.querySelectorAll('[data-base]').forEach(button=>button.addEventListener('click',()=>{
      document.querySelectorAll('[data-base]').forEach(el=>el.classList.toggle('active',el===button));
      document.querySelector('.map-wrap').classList.toggle('fallback-satellite',button.dataset.base==='satellite');
    }));
    fallback.addEventListener('click',event=>{
      const rect=fallback.getBoundingClientRect();
      const x=(event.clientX-rect.left)/rect.width*1000, y=(event.clientY-rect.top)/rect.height*700;
      const lng=GEO.west+x/1000*(GEO.east-GEO.west), lat=GEO.north-y/700*(GEO.north-GEO.south);
      analyze({lat,lng});
    });
    wireCommonControls();
  }
  function wireCommonControls() {
    document.querySelectorAll('[data-layer]').forEach(input=>input.addEventListener('change',()=>{
      const target=layers[input.dataset.layer];
      if(target&&map){if(input.checked)target.addTo(map);else map.removeLayer(target);}
      setFallbackLayer(input.dataset.layer,input.checked);
    }));
    document.getElementById('clear-point').addEventListener('click',clearPoint);
    document.getElementById('share-location').addEventListener('click',shareLocation);
    document.getElementById('manual-point').addEventListener('click',()=>{
      manualSelectionActive=!manualSelectionActive;
      document.getElementById('manual-point').classList.toggle('active',manualSelectionActive);
      document.getElementById('location-help').textContent=manualSelectionActive?'Desloca o mapa até ao local e toca para o analisar':'usa o GPS deste telemóvel para analisar este local';
    });
    document.getElementById('layers-toggle').addEventListener('click',toggleLayers);
    document.getElementById('close-layers').addEventListener('click',toggleLayers);
    document.getElementById('export-button').addEventListener('click',openReport);
    document.getElementById('copy-report').addEventListener('click',copyReport);
    document.getElementById('print-report').addEventListener('click',printReport);
  }
  function analyze(latlng, source='manual') {
    const point=[latlng.lng,latlng.lat];
    const inHunt=pointInRing(point,huntRing), inPark=pointInRing(point,parkRing);
    const inSensitive=sensitivePlaces.some(place=>distanceMeters(point,place.center)<=place.radius);
    const bufferConflict=sensitivePlaces.some(place=>distanceMeters(point,place.center)<=place.radius+250);
    const inCoverage=isInPilotArea(latlng.lat,latlng.lng);
    manualSelectionActive=false;
    document.getElementById('manual-point').classList.remove('active');
    currentAnalysis={lat:latlng.lat,lng:latlng.lng,inHunt,inPark,inSensitive,bufferConflict,inCoverage,source};
    if(map) {
      if(source==='manual')map.setView([latlng.lat,latlng.lng],Math.max(16,map.getZoom()),{animate:true});
      if(marker)map.removeLayer(marker);
      layers.buffer.clearLayers();
      marker=window.L.marker([latlng.lat,latlng.lng],{icon:window.L.divIcon({className:'',html:'<span class="map-pin"></span>',iconSize:[30,38],iconAnchor:[15,37]})}).addTo(map);
      // Halo mantém a borda legível sobre telhados e campos; o preenchimento laranja deixa a área a verificar evidente sem tapar a imagem.
      window.L.circle([latlng.lat,latlng.lng],{radius:250,color:'#fff8ee',weight:8,opacity:.9,fill:false,interactive:false}).addTo(layers.buffer);
      bufferCircle=window.L.circle([latlng.lat,latlng.lng],{radius:250,color:'#bf493d',weight:3,dashArray:'10 6',fillColor:'#ef8b42',fillOpacity:.24,interactive:false}).addTo(layers.buffer);
    }
    drawFallbackSelection(latlng);
    document.getElementById('location-help').textContent=source==='gps'?'Localização do telemóvel · podes escolher outro ponto no mapa':'Ponto alternativo escolhido · podes tocar noutro local';
    renderResult(currentAnalysis);
  }
  function shareLocation() {
    const button=document.getElementById('share-location');
    const label=document.getElementById('location-button-label');
    const status=document.getElementById('location-status');
    status.hidden=true;
    if(!navigator.geolocation){status.textContent='Este browser não disponibiliza localização.';status.hidden=false;return;}
    if(!map){status.textContent='O mapa interativo não está disponível para mostrar a localização.';status.hidden=false;return;}
    button.disabled=true;label.textContent='A obter localização…';
    navigator.geolocation.getCurrentPosition(position=>{
      button.disabled=false;label.textContent='Atualizar localização';
      const latlng={lat:position.coords.latitude,lng:position.coords.longitude};
      map.setView([latlng.lat,latlng.lng],Math.max(16,map.getZoom()),{animate:true});
      analyze(latlng,'gps');
    },error=>{
      button.disabled=false;label.textContent='Partilhar localização';
      status.textContent=error.code===1?'Acesso recusado. Permite a localização nas definições do browser para continuar.':error.code===2?'Não foi possível obter a localização deste dispositivo. Tenta novamente.':'A localização demorou demasiado tempo. Tenta novamente.';
      status.hidden=false;
    },{enableHighAccuracy:true,timeout:20000,maximumAge:30000});
  }
  function updateZoneStatus(state, description) {
    const pill=document.getElementById('zone-status-pill');
    pill.className=`demo-pill status-${state}`;
    const center=map&&map.getCenter();
    const inCoverage=currentAnalysis?currentAnalysis.inCoverage:!center||isInPilotArea(center.lat,center.lng);
    const zoneName=inCoverage?'Serra de Montejunto':'Fora da zona-piloto';
    document.getElementById('zone-status-name').textContent=zoneName;
    pill.setAttribute('aria-label',`${zoneName} · ${description}`);
    document.querySelector('.map-heading strong').textContent=zoneName;
    document.querySelector('.map-heading>span:last-child').textContent=inCoverage?'Cadaval · Alenquer':'Sem dados nesta demo';
  }
  function isInPilotArea(lat,lng) {return lat>=GEO.south&&lat<=GEO.north&&lng>=GEO.west&&lng<=GEO.east;}
  function drawFallbackSelection(latlng) {
    const group=document.getElementById('fallback-selection'); group.replaceChildren();
    const [x,y]=toSvg([latlng.lng,latlng.lat]);
    const radius=250*1000/(111320*Math.cos(latlng.lat*Math.PI/180)*(GEO.east-GEO.west));
    const ns='http://www.w3.org/2000/svg', circle=document.createElementNS(ns,'circle');
    circle.setAttribute('cx',x);circle.setAttribute('cy',y);circle.setAttribute('r',radius);circle.setAttribute('fill','#ef8b42');circle.setAttribute('fill-opacity','.24');circle.setAttribute('stroke','#fff8ee');circle.setAttribute('stroke-opacity','.9');circle.setAttribute('stroke-width','12');group.append(circle);
    const edge=document.createElementNS(ns,'circle');edge.setAttribute('cx',x);edge.setAttribute('cy',y);edge.setAttribute('r',radius);edge.setAttribute('fill','none');edge.setAttribute('stroke','#bf493d');edge.setAttribute('stroke-width','5');edge.setAttribute('stroke-dasharray','12 8');group.append(edge);
    const pin=document.createElementNS(ns,'g');pin.setAttribute('transform',`translate(${x} ${y})`);pin.innerHTML='<path d="M0 14C-17-5-17-21 0-21s17 16 0 35Z" fill="#315d40" stroke="#fff" stroke-width="4"/><circle cy="-8" r="5" fill="#fff"/>';group.append(pin);
  }
  function renderResult(a) {
    let state,label,conclusion,subtext,icon;
    if(!a.inCoverage){state='gray';label='FORA DA ZONA-PILOTO';conclusion='Esta localização está fora da zona-piloto de Montejunto.';subtext='A demo não tem camadas disponíveis para indicar as condições neste local.';icon='i';}
    else if(a.inSensitive){state='red';label='ATENÇÃO · ZONA SENSÍVEL';conclusion='Ponto dentro de zona habitacional / sensível.';subtext='Verifica as regras e condições aplicáveis no local.';icon='!';}
    else if(a.bufferConflict&&a.inPark){state='red';label='CONDICIONANTES ELEVADAS';conclusion='Buffer próximo de zona sensível e área protegida.';subtext='Há áreas sensíveis a menos de 250 m deste ponto.';icon='!';}
    else if(a.bufferConflict){state='yellow';label='ATENÇÃO · PROXIMIDADE';conclusion='Ponto próximo de zona habitacional / sensível.';subtext='O buffer de 250 m intersecta uma zona sensível.';icon='!';}
    else if(a.inHunt&&a.inPark){state='yellow';label='COM CONDICIONANTES';conclusion='Ponto dentro de zona de caça e área protegida.';subtext='Confirma as condicionantes específicas da área protegida.';icon='!';}
    else if(a.inHunt){state='green';label='ZONA DE CAÇA IDENTIFICADA';conclusion='Ponto dentro de zona de caça identificada.';subtext='Sem conflito nas camadas simuladas. Confirma visualmente casas dentro do raio laranja de 250 m.';icon='✓';}
    else{state='gray';label='SEM ZONA IDENTIFICADA';conclusion='Ponto fora de zona de caça identificada.';subtext='A ausência de camada não confirma a situação no terreno.';icon='i';}
    const box=document.getElementById('verdict');box.className=`verdict ${state}`;
    document.getElementById('verdict-icon').textContent=icon;
    document.getElementById('verdict-label').textContent=label;
    document.getElementById('verdict-text').textContent=conclusion;
    document.getElementById('verdict-subtext').textContent=subtext;
    const unknown=a.inCoverage?'Não':'Sem dados';
    document.getElementById('detail-hunt').textContent=a.inCoverage?(a.inHunt?'Sim':'Não'):'Sem dados';
    document.getElementById('detail-type').textContent=a.inCoverage?(a.inHunt?'Zona de Caça Municipal':'—'):'—';
    document.getElementById('detail-park').textContent=a.inCoverage?(a.inPark?'Sim':'Não'):unknown;
    document.getElementById('detail-sensitive').textContent=a.inCoverage?(a.inSensitive?'Sim':'Não'):unknown;
    document.getElementById('detail-buffer').textContent=a.inCoverage?(a.bufferConflict?'Conflito simulado':'Sem conflito simulado'):'Sem dados';
    const statusDescription=state==='green'?'zona de caça identificada nas camadas da demo':state==='yellow'?'condicionantes a analisar':state==='red'?'zona sensível ou conflito nas camadas da demo':'sem dados suficientes nesta zona';
    updateZoneStatus(state,statusDescription);
    document.getElementById('coordinates').textContent=`${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}`;
    document.getElementById('empty-state').hidden=true;document.getElementById('result').hidden=false;
    document.getElementById('export-button').disabled=false;
    document.getElementById('intro').textContent='Segundo as camadas disponíveis nesta demo, este ponto apresenta as condições abaixo.';
  }
  function clearPoint() {
    if(map&&marker)map.removeLayer(marker);if(layers.buffer)layers.buffer.clearLayers();
    marker=null;bufferCircle=null;currentAnalysis=null;document.getElementById('fallback-selection').replaceChildren();
    document.getElementById('empty-state').hidden=false;document.getElementById('result').hidden=true;
    document.getElementById('export-button').disabled=true;
    document.getElementById('intro').textContent='Partilha a tua localização para ver as condições deste ponto. Também podes adicionar um ponto alternativo no mapa.';
    document.getElementById('location-help').textContent='usa o GPS deste telemóvel para analisar este local';
    document.getElementById('location-status').hidden=true;
    document.getElementById('location-button-label').textContent='Partilhar localização';
    manualSelectionActive=false;document.getElementById('manual-point').classList.remove('active');
    updateZoneStatus('gray','escolha um ponto para analisar');
  }
  function toggleLayers(){const panel=document.getElementById('layer-panel'),button=document.getElementById('layers-toggle');panel.hidden=!panel.hidden;button.setAttribute('aria-expanded',String(!panel.hidden));}
  function reportContent(){const a=currentAnalysis;if(!a)return'';const available=a.inCoverage?'':'Sem dados fora da zona-piloto';return `Caça Aqui · Zonas de Caça Seguras\n\nCoordenadas aproximadas: ${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}\nEstado: ${document.getElementById('verdict-label').textContent}\nConclusão: ${document.getElementById('verdict-text').textContent}\n\nZona de caça: ${available|| (a.inHunt?'Sim (Zona de Caça Municipal)':'Não identificada')}\nÁrea protegida: ${available|| (a.inPark?'Sim':'Não')}\nZona sensível simulada: ${available|| (a.inSensitive?'Sim':'Não detetada nas camadas simuladas')}\nZona a verificar: raio de 250 m assinalado a laranja/vermelho no mapa impresso.\nConflito nas camadas sensíveis simuladas: ${available|| (a.bufferConflict?'Sim':'Não detetado')}\n\nLeitura visual: verificar casas, telhados e outras zonas sensíveis visíveis dentro da área colorida. As cores da imagem satélite não são classificadas automaticamente.\nFonte: camadas simuladas para demonstração.\n\nEsta ferramenta é uma ajuda visual baseada em camadas disponíveis. Não substitui a legislação, a sinalização no terreno, o calendário venatório nem a confirmação junto das entidades competentes.`;}
  function openReport(){document.getElementById('report-text').textContent=reportContent();document.getElementById('report-dialog').showModal();}
  function printReport(){document.getElementById('report-dialog').close();document.body.classList.add('printing-report');setTimeout(()=>{window.print();document.body.classList.remove('printing-report');},100);}
  async function copyReport(){const button=document.getElementById('copy-report');try{await navigator.clipboard.writeText(reportContent());button.textContent='Resumo copiado';}catch{button.textContent='Não foi possível copiar';}setTimeout(()=>button.textContent='Copiar resumo',1800);}
  document.addEventListener('DOMContentLoaded',initMap);
})();