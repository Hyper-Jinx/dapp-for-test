import { useCallback, useMemo, useState } from 'react'
import { clusterApiUrl, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { ConnectionProvider, useAnchorWallet, useConnection, useWallet, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { BackpackWalletAdapter } from '@solana/wallet-adapter-backpack'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'

import '@solana/wallet-adapter-react-ui/styles.css'

const SOL_TRANSFER_LAMPORTS = 100000 // 0.0001 SOL
const LONG_MESSAGE_BYTES = 30 * 1024 // 30KB
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

	const signLongMessage = useCallback(async () => {
		try {
			if (!wallet.signMessage) throw new Error('当前钱包不支持消息签名')
			const longMessage = new Uint8Array(LONG_MESSAGE_BYTES)
			for (let i = 0; i < longMessage.length; i++) longMessage[i] = i % 256
			const signature = await wallet.signMessage(longMessage)
			setStatus(`超长消息(${LONG_MESSAGE_BYTES}B)签名成功: ${Buffer.from(signature).toString('hex').slice(0, 32)}...`)
		} catch (err: any) {
			setStatus(`超长消息签名失败: ${err?.message || String(err)}`)
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
			const serialized = tx.serialize()
			if (serialized.length < LONG_TX_TARGET_SERIALIZED_BYTES) {
				setStatus(`警告: 序列化后大小 ${serialized.length}B 未达到目标 ${LONG_TX_TARGET_SERIALIZED_BYTES}B，但仍将发送`)
			}
			const sig = await connection.sendRawTransaction(serialized)
			await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
			setStatus(`长交易已确认: ${sig} （序列化 ${serialized.length}B）`)
		} catch (err: any) {
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
				<button onClick={signLongMessage} disabled={!wallet.connected}>
					签名超长消息（30KB）
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
	// Use mainnet or devnet; here we use devnet to avoid real SOL spending
	const endpoint = useMemo(() => clusterApiUrl('devnet'), [])
	const wallets = useMemo(
		() => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()],
		[],
	)

	return (
		<ConnectionProvider endpoint={endpoint} config={{ commitment: 'confirmed' }}>
			<WalletProvider wallets={wallets} autoConnect>
				<WalletModalProvider>
					<SolanaActions />
				</WalletModalProvider>
			</WalletProvider>
		</ConnectionProvider>
	)
}


