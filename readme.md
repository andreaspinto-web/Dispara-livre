# Caça Aqui — Zonas de Caça Seguras

Demo estática mobile-first da Serra de Montejunto. Não usa backend nem login. O browser só pede localização do dispositivo depois de a pessoa tocar em «Partilhar localização». Publicável no Netlify sem comando de build.

## Ficheiros

- `index.html` — estrutura da aplicação e mapa esquemático SVG de reserva incorporado.
- `styles.css` — interface responsiva.
- `app.js` — mapa Leaflet, análise geográfica simples e interação de reserva sem dependência de Turf.js.

## Para experimentar

Abra `index.html` num servidor estático ou publique os ficheiros no Netlify. Com ligação disponível, a vista inicial usa imagem aérea Esri; o botão «Mapa» alterna para OpenStreetMap. O botão central «Partilhar localização» pede autorização de GPS após o toque, centra o mapa no dispositivo e analisa esse ponto. O botão «+» no canto inferior esquerdo ativa a escolha de um ponto alternativo; desloca o mapa e toca no local a analisar. Fora da cobertura simulada, a app informa que não tem dados em vez de inferir uma proibição. Se a biblioteca do mapa não carregar no browser, a ilustração local permanece visível e permite selecionar pontos, alternar camadas e ver a análise. `?map=local` ativa esse modo de reserva para pré-visualização.

O mapa ilustrativo local é apenas um esquema visual da envolvente; não substitui a cartografia real. As geometrias de caça, área protegida, povoações e limites também são simuladas e não são adequadas a decisões reais.

## Evolução para dados reais

- TODO: substituir zona de caça simulada por dados reais do ICNF.
- TODO: substituir área protegida simulada por dados reais.
- TODO: integrar camadas reais de habitações/povoações.
- TODO: trocar a base local esquemática por uma imagem licenciada ou por mapa online contínuo.