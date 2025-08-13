import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import './App.css'

const SolanaTest = lazy(() => import('./pages/SolanaTest'))

function App() {
  return (
    <div className="App">
      <Routes>
        <Route
          path="/"
          element={
            <div style={{ padding: 24 }}>
              <h2>链测试目录</h2>
              <ul>
                <li>
                  <Link to="/solana">Solana 链测试</Link>
                </li>
                <li style={{ opacity: 0.5, pointerEvents: 'none' }}>
                  Aptos 链测试（待实现）
                </li>
              </ul>
            </div>
          }
        />
        <Route
          path="/solana"
          element={
            <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
              <SolanaTest />
            </Suspense>
          }
        />
      </Routes>
    </div>
  )
}

export default App
