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

const basename = (import.meta as any).env?.BASE_URL
	? ((import.meta as any).env.BASE_URL as string).replace(/\/$/, '')
	: ''

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<BrowserRouter basename={basename}>
			<App />
		</BrowserRouter>
	</StrictMode>,
)
