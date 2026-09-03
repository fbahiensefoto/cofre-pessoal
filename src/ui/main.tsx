import { render } from 'preact';
import { App } from './App';
import { reconcileThemeFromIndexedDB } from './lib/useTheme';
import './styles/theme.css';

// Roda uma vez por carregamento de página, não presa a nenhum componente —
// ver o comentário em reconcileThemeFromIndexedDB para o motivo.
void reconcileThemeFromIndexedDB();

const root = document.getElementById('root');
if (root) {
  render(<App />, root);
}
