// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

jest.mock('leaflet', () => ({
  Icon: function Icon() {},
  divIcon: jest.fn(() => ({})),
}));

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="map">{children}</div>,
  Marker: ({ children }) => <div>{children}</div>,
  Popup: ({ children }) => <div>{children}</div>,
  TileLayer: () => null,
  Circle: () => null,
  useMap: () => ({ invalidateSize: jest.fn(), setView: jest.fn(), getZoom: () => 15 }),
  useMapEvents: () => ({ setView: jest.fn(), getZoom: () => 15 }),
}));
