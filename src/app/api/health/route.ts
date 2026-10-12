import {NextResponse} from 'next/server';
export function GET(){return NextResponse.json({service:'KnowBridge',status:'scaffold-ready',aiEnabled:false,syntheticData:true});}
