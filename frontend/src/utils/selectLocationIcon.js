import L from 'leaflet';

const selectLocationIcon = L.divIcon({
  className: '',
  html: `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 9999px;
      border: 3px solid #ffffff;
      background: #0891b2;
      box-shadow: 0 14px 30px rgba(8, 145, 178, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      <div style="
        width: 12px;
        height: 12px;
        border-radius: 9999px;
        border: 2px solid #ffffff;
        background: #22d3ee;
      "></div>
    </div>
  `,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
  popupAnchor: [0, -18],
});

export default selectLocationIcon;
