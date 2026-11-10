import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initNetlifyRuntimeBridge} from './utils/netlifyClientBridge';

initNetlifyRuntimeBridge();

createRoot(document.getElementById('root')!).render(<App />);

