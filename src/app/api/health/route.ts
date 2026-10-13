import {NextResponse} from 'next/server';
export function GET(){return NextResponse.json({service:'KnowBridge',status:'source-catalog-ready',aiEnabled:false,syntheticData:true,storage:process.env.KNOWBRIDGE_STORE ?? (process.env.K_SERVICE ? 'firestore' : 'file')});}
