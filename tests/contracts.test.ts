import {describe,expect,it} from 'vitest';
import {DecisionBriefSchema,verifySourceReferences} from '../src/lib/contracts';
const example={question:'Can Harbour launch?',status:'at_risk',recommendation:'Do not confirm until QA and security approval.',
  supportingClaims:[{claim:'Security remains pending',evidence:[{sourceId:'HBR-DOC-06',sourceTitle:'Security Assessment',excerpt:'Production release approval: PENDING.'}]}],
  conflicts:[],alternatives:[{option:'Delay commitment',tradeoff:'Requires client alignment'}],unknowns:['Client acceptance'],
  suggestedNextStep:'Request revised QA and security sign-off.',reviewedByHuman:false};
describe('decision contracts',()=>{
  it('accepts grounded brief',()=>{
    const parsed=DecisionBriefSchema.parse(example);
    expect(verifySourceReferences(parsed,new Map([['HBR-DOC-06','Production release approval: PENDING.']]))).toEqual([]);
  });
  it('rejects unknown source',()=>{
    const parsed=DecisionBriefSchema.parse(example);
    expect(verifySourceReferences(parsed,new Map())).toHaveLength(1);
  });
  it('rejects fabricated excerpt',()=>{
    const parsed=DecisionBriefSchema.parse(example);
    expect(verifySourceReferences(parsed,new Map([['HBR-DOC-06','Production release approval: APPROVED.']]))).toHaveLength(1);
  });
});
