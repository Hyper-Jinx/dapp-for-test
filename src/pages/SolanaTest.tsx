import { useCallback, useEffect, useMemo, useState } from 'react'
import { clusterApiUrl, PublicKey, SendTransactionError, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { ConnectionProvider, useAnchorWallet, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'

import '@solana/wallet-adapter-react-ui/styles.css'

const SOL_TRANSFER_LAMPORTS = 100000 // 0.0001 SOL
const LONG_TX_TARGET_SERIALIZED_BYTES = 1000
const LONG_TX_MAX_MEMOS = 40
const LONG_TX_MEMO_SIZE = 96 // 96 bytes per memo payload
const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'

function SolanaActions() {
	const { connection } = useConnection()
	const wallet = useWallet()
	const anchorWallet = useAnchorWallet()
	const [status, setStatus] = useState<string>('')

	const signMessage = useCallback(async () => {
		try {
			if (!wallet.signMessage) throw new Error('当前钱包不支持消息签名')
			const message = new TextEncoder().encode('Hello from dapp-for-test')
			const signature = await wallet.signMessage(message)
			setStatus(`消息签名成功: ${Buffer.from(signature).toString('hex').slice(0, 32)}...`)
		} catch (err: any) {
			setStatus(`消息签名失败: ${err?.message || String(err)}`)
		}
	}, [wallet])


	const signAndSendTransfer = useCallback(async () => {
		try {
			if (!wallet.publicKey) throw new Error('请先连接钱包')
			const payerPublicKey = wallet.publicKey
			const toPublicKey = new PublicKey(payerPublicKey)

			const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

			const ix = SystemProgram.transfer({
				fromPubkey: payerPublicKey,
				toPubkey: toPublicKey,
				lamports: SOL_TRANSFER_LAMPORTS,
			})

			const messageV0 = new TransactionMessage({
				payerKey: payerPublicKey,
				recentBlockhash: blockhash,
				instructions: [ix],
			}).compileToV0Message()

			const tx = new VersionedTransaction(messageV0)

			if (!wallet.signTransaction) throw new Error('当前钱包不支持交易签名')
			await wallet.signTransaction(tx)
			const sig = await connection.sendRawTransaction(tx.serialize())
			await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
			setStatus(`交易已确认: ${sig}`)
		} catch (err: any) {
			setStatus(`交易发送失败: ${err?.message || String(err)}`)
		}
	}, [wallet, connection])

	const signAndSendLongTransaction = useCallback(async () => {
		try {
			if (!wallet.publicKey) throw new Error('请先连接钱包')
			const payerPublicKey = wallet.publicKey
			const memoProgramId = new PublicKey(MEMO_PROGRAM_ID)

			// Build instructions until estimated serialized bytes exceed threshold
			const { blockhash: initialBlockhash } = await connection.getLatestBlockhash()
			const buildMemo = (index: number) => {
				const memoText = `memo-${index}: ` + 'X'.repeat(LONG_TX_MEMO_SIZE)
				return new TransactionInstruction({
					programId: memoProgramId,
					keys: [{ pubkey: payerPublicKey, isSigner: true, isWritable: false }],
					data: Buffer.from(memoText, 'utf8'),
				})
			}

			const instructions: Array<TransactionInstruction> = []
			// Always include the final transfer at the end; we'll append after memos
			let estimatedSize = 0
			for (let i = 0; i < LONG_TX_MAX_MEMOS; i++) {
				instructions.push(buildMemo(i))
				const draftMessage = new TransactionMessage({
					payerKey: payerPublicKey,
					recentBlockhash: initialBlockhash,
					instructions: [
						...instructions,
						SystemProgram.transfer({
							fromPubkey: payerPublicKey,
							toPubkey: payerPublicKey,
							lamports: SOL_TRANSFER_LAMPORTS,
						}),
					],
				}).compileToV0Message()
				const messageBytes = draftMessage.serialize().length
				estimatedSize = 1 /* signatures length varint for 1 sig */ + 64 /* one signature */ + messageBytes
				if (estimatedSize >= LONG_TX_TARGET_SERIALIZED_BYTES) break
			}

			// Rebuild with a fresh blockhash for sending
			const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
			const finalMessage = new TransactionMessage({
				payerKey: payerPublicKey,
				recentBlockhash: blockhash,
				instructions: [
					...instructions,
					SystemProgram.transfer({
						fromPubkey: payerPublicKey,
						toPubkey: payerPublicKey,
						lamports: SOL_TRANSFER_LAMPORTS,
					}),
				],
			}).compileToV0Message()
			const tx = new VersionedTransaction(finalMessage)

			if (!wallet.signTransaction) throw new Error('当前钱包不支持交易签名')
			await wallet.signTransaction(tx)

			// Preflight: simulate with signature verification to capture detailed logs
			const simulation = await connection.simulateTransaction(tx, { sigVerify: true })
			if (simulation.value.err) {
				const logs = simulation.value.logs || []
				const serialized = tx.serialize()
				setStatus(
					`模拟失败: ${JSON.stringify(simulation.value.err)}\n` +
					`logs:\n${logs.join('\n')}\n` +
					`序列化大小: ${serialized.length}B (目标 ${LONG_TX_TARGET_SERIALIZED_BYTES}B)`
				)
				return
			}

			const serialized = tx.serialize()
			if (serialized.length < LONG_TX_TARGET_SERIALIZED_BYTES) {
				setStatus(`警告: 序列化后大小 ${serialized.length}B 未达到目标 ${LONG_TX_TARGET_SERIALIZED_BYTES}B，但仍将发送`)
			}
			const sig = await connection.sendRawTransaction(serialized, { skipPreflight: false })
			await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
			setStatus(`长交易已确认: ${sig} （序列化 ${serialized.length}B）`)
		} catch (err: any) {
			if (err instanceof SendTransactionError || typeof err?.getLogs === 'function') {
				try {
					const logs = await err.getLogs?.(connection)
					setStatus(`长交易发送失败: ${err.message}\nlogs:\n${(logs || []).join('\n')}`)
					return
				} catch {}
			}
			setStatus(`长交易发送失败: ${err?.message || String(err)}`)
		}
	}, [wallet, connection])

	return (
		<div style={{ padding: 24 }}>
			<div style={{ marginBottom: 12 }}>
				<WalletMultiButton />
			</div>
			<div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
				<button onClick={signMessage} disabled={!wallet.connected}>
					签名消息
				</button>
				<button onClick={signAndSendTransfer} disabled={!wallet.connected}>
					签名并发送 0.0001 SOL 自转账
				</button>
				<button onClick={signAndSendLongTransaction} disabled={!wallet.connected}>
					签署较长交易（含多条 Memo）并发送 0.0001 SOL
				</button>
			</div>
			{anchorWallet?.publicKey && (
				<p style={{ marginTop: 12, wordBreak: 'break-all' }}>
					当前地址: {anchorWallet.publicKey.toBase58()}
				</p>
			)}
			{status && (
				<p style={{ marginTop: 12, wordBreak: 'break-all' }}>{status}</p>
			)}
		</div>
	)
}

export default function SolanaTest() {
	// Allow runtime-configurable RPC endpoint with fallbacks
	const defaultEndpoint = (import.meta as any).env?.VITE_SOLANA_RPC || clusterApiUrl('mainnet-beta')
	const [endpoint, setEndpoint] = useState<string>(() => {
		try {
			const params = new URLSearchParams(window.location.search)
			const fromParam = params.get('rpc')
			const stored = localStorage.getItem('solanaRpcEndpoint')
			return (fromParam || stored || defaultEndpoint) as string
		} catch {
			return defaultEndpoint as string
		}
	})
	const [rpcInput, setRpcInput] = useState<string>(endpoint)

	useEffect(() => {
		setRpcInput(endpoint)
	}, [endpoint])
	const wallets = useMemo(
		() => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()],
		[],
	)

	return (
		<ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
			<WalletProvider wallets={wallets} autoConnect>
				<WalletModalProvider>
					<div style={{ padding: 24, border: '1px solid #eee', borderRadius: 8, margin: '0 24px 12px' }}>
						<label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>RPC Endpoint</label>
						<div style={{ display: 'flex', gap: 8 }}>
							<input
								value={rpcInput}
								onChange={(e) => setRpcInput(e.target.value)}
								placeholder="https://your.rpc.endpoint"
								style={{ flex: 1, padding: 8 }}
							/>
							<button
								onClick={() => {
									setEndpoint(rpcInput.trim())
									try {
										localStorage.setItem('solanaRpcEndpoint', rpcInput.trim())
									} catch {}
								}}
							>
								应用
							</button>
						</div>
						<p style={{ marginTop: 6, color: '#666' }}>支持 URL 参数 ?rpc=... 覆盖。默认 {defaultEndpoint}</p>
					</div>
					<SolanaActions />
				</WalletModalProvider>
			</WalletProvider>
		</ConnectionProvider>
	)
}


