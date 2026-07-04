import { render, screen } from '@testing-library/react';
import App from './App';

test('renders TaskFlow landing page', () => {
  render(<App />);
  expect(screen.getAllByText(/TaskFlow/i).length).toBeGreaterThan(0);
});
