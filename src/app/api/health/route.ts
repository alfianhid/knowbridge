import {NextResponse} from 'next/server';
import { retrievalMode } from '../../../lib/ask';
import { getAIConfig } from '../../../lib/gemini';

export function GET(): NextResponse {
  try {
    const retrieval = retrievalMode();
    if (retrieval === 'vertex') getAIConfig();
    return NextResponse.json({ service: 'KnowBridge', status: 'grounded-search-ready',
      aiEnabled: retrieval === 'vertex', retrieval, connectivityVerified: false, syntheticData: true,
      storage: process.env.KNOWBRIDGE_STORE ?? (process.env.K_SERVICE ? 'firestore' : 'file') });
  } catch {
    return NextResponse.json({ service: 'KnowBridge', status: 'configuration-required', aiEnabled: false,
      connectivityVerified: false, syntheticData: true }, { status: 503 });
  }
}
