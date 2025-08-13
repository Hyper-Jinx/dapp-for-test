import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { Buffer } from 'buffer'

// Ensure Buffer is available for web3.js in the browser
if (!(globalThis as any).Buffer) {
	(globalThis as any).Buffer = Buffer
}

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter>
			<App />
		</BrowserRouter>
	</StrictMode>,
)
