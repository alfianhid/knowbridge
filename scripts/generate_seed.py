#!/usr/bin/env python3
"""Deterministic and wholly fictional Southeast Asian SME Workspace-like knowledge corpus.
No packages required. No imported customer/employee data. Safe to regenerate.
"""
import argparse, csv, json, random, re
from datetime import date, timedelta
from pathlib import Path

SEED = 20261012
ORG = 'North Quay Digital Pte. Ltd. (FICTIONAL DEMO COMPANY)'
TODAY = '2026-10-11'
PROJECTS = [
 ('HBR','Project Harbour','customer self-service portal','Harbourlight Retail (fictional)','Avery Tan','2026-11-01',10,'Horizon Cloud (fictional)'),
 ('MER','Project Meridian','supplier onboarding portal','Meridian Trading (fictional)','Elena Koh','2026-11-04',8,'Beacon Verify (fictional)'),
 ('NTH','Project Northstar','executive reporting dashboards','Northstar Foods (fictional)','Kiran Lim','2026-11-06',5,'Summit Data (fictional)'),
 ('ORC','Project Orchard','subscription renewal workflow','Orchard Works (fictional)','Sofia Lee','2026-11-09',7,'Crest Billing (fictional)'),
 ('BCN','Project Beacon','identity and access consolidation','Beacon Ventures (fictional)','Darren Ng','2026-11-12',9,'Harbour IAM (fictional)'),
 ('ATL','Project Atlas','new-joiner employee experience','Atlas Logistics (fictional)','Priya Menon','2026-11-15',3,'Mosaic HR (fictional)'),
 ('JNP','Project Juniper','partner onboarding workspace','Juniper Studio (fictional)','Noah Goh','2026-11-18',6,'Pioneer Forms (fictional)'),
 ('CDR','Project Cedar','billing system migration','Cedar Commerce (fictional)','Mei Chen','2026-11-21',11,'Aurora Ledger (fictional)'),
]
DOC_TYPES = [
 'Project Charter','Customer Commitments','Delivery Plan','QA Forecast','Risk Register','Security Assessment',
 'Steering Committee Minutes','Resource Constraints','Decision Log','Support Handover',
 'Launch Runbook','Dependency Review','Commercial Scope','Stakeholder Update','Change Control','Open Questions'
]
DOCUMENT_DATES = {
 'Project Charter':'2026-08-19', 'Customer Commitments':'2026-10-07',
 'Delivery Plan':'2026-09-09', 'QA Forecast':'2026-10-10',
 'Risk Register':'2026-10-11', 'Security Assessment':'2026-10-11',
 'Steering Committee Minutes':'2026-10-11', 'Resource Constraints':'2026-10-09',
 'Decision Log':'2026-10-11', 'Support Handover':'2026-10-08',
 'Launch Runbook':'2026-09-25', 'Dependency Review':'2026-10-08',
 'Commercial Scope':'2026-09-12', 'Stakeholder Update':'2026-10-11',
 'Change Control':'2026-10-10', 'Open Questions':'2026-10-11'
}
POLICIES = [
 ('Launch Readiness','Production launch requires documented QA completion, security approval and named on-call owner.'),
 ('Customer Commitments','A committed customer date must be approved by the delivery owner and recorded in the decision log.'),
 ('Escalation','Critical unresolved launch risks must be escalated to the accountable sponsor within one working day.'),
 ('Access Control','Internal documents are shared on a least-privilege basis; clients do not receive internal risk registers.'),
 ('Vendor Due Diligence','New vendors require security review, contract confirmation and accountable owner before activation.'),
 ('Financial Approvals','New spend exceeding SGD 10,000 requires finance lead review before issuing a purchase order.'),
 ('Data Handling','Synthetic datasets are permitted for tests; customer data needs legal basis, minimisation and retention controls.'),
 ('Change Management','A revised delivery date must include rationale, customer notification owner and a versioned plan.'),
]
PEOPLE = [
 ('Avery Tan','Delivery Manager'),('Elena Koh','Operations Manager'),('Kiran Lim','Engineering Lead'),
 ('Sofia Lee','Customer Success Lead'),('Darren Ng','Security Lead'),('Priya Menon','People Operations Lead'),
 ('Noah Goh','Partnerships Lead'),('Mei Chen','Finance Lead'),('Isabelle Wong','QA Lead'),
 ('Haris Rahman','Platform Engineer'),('Lena Ong','Product Manager'),('Theo Yeo','Solutions Architect'),
 ('Nadia Ismail','Sales Lead'),('Marco Chua','Support Lead'),('Jules Teo','Data Analyst'),
 ('Farah Aziz','People Partner'),('Jun Park','UX Designer'),('Bella Low','Account Executive'),
 ('Arun Nair','Application Engineer'),('Eden Ho','Compliance Analyst'),('Ravi Das','Technical Writer'),
 ('Mira Foo','Program Coordinator'),('Hadi Salleh','Customer Support'),('Chloe Yap','Operations Analyst'),
 ('Leo Tan','Engineering Manager'),('Dana Lim','QA Engineer'),('Imran Koh','SRE'),('Tessa Chan','Procurement Lead'),
 ('Selin Ng','Project Coordinator'),('Omar Aziz','Business Analyst')
]
TEAM_NAMES = ['Delivery','Engineering','Product','Security','Operations','Customer Success','Finance','People Operations']

def plus(value, days): return (date.fromisoformat(value)+timedelta(days=days)).isoformat()
def slug(s): return re.sub(r'[^a-z0-9]+','-',s.lower()).strip('-')
def save_json(path,obj): path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
def save_csv(path,header,rows):
    path.parent.mkdir(parents=True,exist_ok=True)
    with path.open('w',newline='',encoding='utf-8') as f:
        writer=csv.writer(f,lineterminator='\n');writer.writerow(header);writer.writerows(rows)

def document_body(code, name, service, client, owner, planned, qa, vendor, typ, idx):
    header=f'''KNOWBRIDGE SYNTHETIC DEMO DATA — NOT A REAL COMPANY RECORD
Organization: {ORG}
Project: {name} ({code})
Client: {client}
Delivery owner: {owner}
Scope: {service}
Third-party dependency: {vendor}
Document type: {typ}
Recorded date: {DOCUMENT_DATES[typ]}
Reference project baseline: {planned}

'''
    common=f'''PROJECT CONTEXT
The engagement is a controlled delivery project for a Southeast Asian SME. The shared project ID is {code}. The client-facing milestone is {planned}, initially proposed during planning. Every operational update must preserve the source date so decision reviewers can distinguish an initial forecast from a subsequent revision. The relevant stakeholders are {owner}, Isabelle Wong (QA), and Darren Ng (security). Team communications are in English, and all budgets are denominated in SGD. This entry is a synthetic example, not a representation of any actual contract or customer.

'''
    detail={
      'Project Charter':f'''BASELINE AND ASSUMPTIONS
Project start was approved on 2026-08-19. The initial target for production launch was {planned}, conditional on QA passing, security approval, operational handover and customer acceptance. In the original baseline, a full release was preferable to a pilot. These assumptions have not been independently revalidated since 2026-08-19. The charter is the record of original intent, not the latest operational status.
Decision owner: {owner}. Finance sponsor: Mei Chen.
''',
      'Customer Commitments':f'''CLIENT EXPECTATION — 2026-10-07
The client team continues planning around {planned} for delivery of the {service}. Their launch communication has not been updated since the 2026-08-19 baseline. {owner} explained that a revised commitment requires written approval and a customer update. The client has not yet accepted a new date or a reduced-scope pilot.
Open customer decision: whether a staged rollout is acceptable.
''',
      'Delivery Plan':f'''DELIVERY PLAN, REVISION 1 — 2026-09-09
A production launch is scheduled for {planned} subject to all exit criteria. The original plan allocates five working days for final QA and one day for the release review. The plan has not incorporated the 2026-10-10 QA forecast and should be treated as a baseline. The accountable owner must publish revision 2 if release timing changes.
''',
      'QA Forecast':f'''QUALITY ASSURANCE UPDATE — 2026-10-10
The latest forecast for final regression completion is {qa}. That is later than the initial customer target {planned}. QA coverage is incomplete: integration regression remains pending and one external test environment has intermittent failures. Isabelle Wong owns sign-off, which has not been issued. There is no approved evidence that production QA is complete. Status: AT RISK.
''',
      'Risk Register':f'''RISK REGISTER — 2026-10-11
Risk R-{code}-01: QA forecast {qa} does not support the published customer target {planned}. Likelihood HIGH, impact HIGH. Risk R-{code}-02: security sign-off remains PENDING as of 2026-10-11. Likelihood MEDIUM, impact HIGH. Risk R-{code}-03: additional specialist QA capacity is unavailable before 2026-10-16. Mitigation: customer conversation, updated plan, and controlled pilot assessment. No mitigation has been approved as a new launch commitment.
''',
      'Security Assessment':f'''SECURITY REVIEW — 2026-10-11
Production release approval: PENDING. Darren Ng has requested a final access-control walkthrough and proof that privileged access is logged. No security sign-off has been recorded. A limited pilot may be considered only with its own documented risk acceptance and security scope; a pilot is not automatically approved. Do not mark the release as compliant or production-ready.
''',
      'Steering Committee Minutes':f'''STEERING REVIEW — 2026-10-11
The committee reviewed the mismatch between the client expectation of {planned} and the QA team forecast of {qa}. The committee requested options rather than endorsing a revised date. {owner} must prepare a decision brief comparing full release postponement, reduced-scope pilot, and a date renegotiation. The original target remains a customer expectation, not a currently verified feasible commitment.
''',
      'Resource Constraints':f'''RESOURCE ALLOCATION UPDATE — 2026-10-09
QA allocation is fully utilized through 2026-10-16. The team cannot add specialist test capacity without disrupting another signed commitment. Engineering has two open dependencies on {vendor}. Increasing working hours is not an approved mitigation. An extension or staged scope is therefore more credible than assuming additional QA resources.
''',
      'Decision Log':f'''DECISION RECORDS — THROUGH 2026-10-11
D-{code}-001 on 2026-08-19: approve initial planning baseline for {planned}; owner {owner}. D-{code}-002 on 2026-10-11: escalate delivery schedule conflict to leadership; owner {owner}; status OPEN. No decision authorizing a later full-release date exists in this log. No completed customer approval for a pilot exists in this log. Do not infer approval from the presence of a proposal.
''',
      'Support Handover':f'''SUPPORT READINESS — 2026-10-08
Handover checklist has outstanding items: post-launch support rota confirmation, incident escalation rehearsals, and release notes sign-off. Marco Chua is designated the support coordinator. Operational readiness remains INCOMPLETE. The support team requires three working days after a stable release candidate to complete handover.
''',
      'Launch Runbook':f'''RELEASE RUNBOOK, WORKING DRAFT — 2026-09-25
Proposed sequence: complete regression tests, approve security evidence, confirm on-call owner, secure written customer confirmation, and schedule a production change window. Current runbook is a draft and is not an approval record. The draft still references target {planned}; check later risk and QA documents for current viability.
''',
      'Dependency Review':f'''THIRD-PARTY DEPENDENCIES — 2026-10-08
{vendor} provides a non-production service endpoint required for the {service}. The team expects written verification of the integration contract and confirmation of a rollback procedure. Dependency status: AMBER. No confirmed completion is recorded for the external dependency review.
''',
      'Commercial Scope':f'''COMMERCIAL POSITION — 2026-09-12
Fixed-fee baseline covers full {service} at the originally planned acceptance date {planned}. Additional pilot support or date extension may affect scope and cost. Mei Chen must review any material commercial change. No revised statement of work has been signed. This document does not override the delivery or security release gates.
''',
      'Stakeholder Update':f'''CROSS-FUNCTIONAL UPDATE — 2026-10-11
Engineering forecasts QA completion {qa}. Customer communications still mention {planned}. Security approval is pending. Leadership is aware of the discrepancy but has not made a definitive schedule decision. Next milestone is a leadership decision meeting on 2026-10-14. Suggested next step: validate assumptions and send a single reconciled status to the client.
''',
      'Change Control':f'''CHANGE REQUEST CR-{code}-08 — 2026-10-10
Proposal: assess a reduced-scope pilot around {planned} and a full production release after QA completion {qa}. Status: DRAFT / NOT APPROVED. The request must document test scope, security acceptance, customer approval and commercial impact. Do not treat this proposal as a final decision.
''',
      'Open Questions':f'''UNRESOLVED QUESTIONS — 2026-10-11
1. Will the customer agree to move the full release after {qa}?
2. Is a limited pilot viable with separate security acceptance?
3. When will the external dependency {vendor} be formally verified?
4. Which revised launch date can {owner} responsibly approve?
5. What proof is required for support readiness and final regression sign-off?
Unknown answers must be stated as unknown, not guessed.
''',
    }[typ]
    return header+common+detail+'''EVIDENCE CAUTION
This is a synthetic internal record. Conclusions should cite the specific document and distinguish recorded expectations from verified readiness. A no-evidence situation is not proof of completion.
'''

def generate(out):
    random.seed(SEED)
    out.mkdir(parents=True, exist_ok=True)
    docs=[]; sheets=[]; links=[]; truth=[]
    for i,(code,name,service,client,owner,planned,delay,vendor) in enumerate(PROJECTS):
        qa=plus(planned,delay)
        for j,typ in enumerate(DOC_TYPES):
            doc_id=f'{code}-DOC-{j+1:02d}'
            updated=DOCUMENT_DATES[typ]
            content=document_body(code,name,service,client,owner,planned,qa,vendor,typ,j)
            name_on_disk=f'{doc_id}-{slug(typ)}.txt'
            (out/'docs').mkdir(exist_ok=True)
            (out/'docs'/name_on_disk).write_text(content,encoding='utf-8',newline='\n')
            docs.append(dict(id=doc_id,title=f'{name} — {typ}',kind='google_doc',project=code,
                department=['Delivery','Engineering','Security','Operations'][j%4],owner=owner,modified_at=updated,
                file=f'docs/{name_on_disk}',content=content,synthetic=True,visibility='internal'))
        truth.append(dict(id=f'CASE-{code}',project=code,
            question=f'Can we commit to launching {name} on {planned}? Identify conflicting evidence and recommend a next step.',
            expected='Do not confirm the original full-production date without revised QA, security and customer approval.',
            facts={'original_target':planned,'qa_forecast':qa,'security':'PENDING','client_change_approved':False},
            required_source_ids=[f'{code}-DOC-02',f'{code}-DOC-04',f'{code}-DOC-05',f'{code}-DOC-06',f'{code}-DOC-09'],
            conflict_type='outdated_baseline_vs_newer_qa_forecast',
            prohibited_claims=['security approved','QA complete','client accepted revised date'],
            expected_unknowns=['customer approval for a revised date','pilot risk acceptance']))
        milestone_header=['project_id','milestone','baseline_date','current_forecast','state','owner','recorded_date']
        milestone_rows=[
         [code,'Customer production target',planned,planned,'CUSTOMER_EXPECTATION',owner,'2026-10-07'],
         [code,'Final regression complete',plus(planned,-7),qa,'FORECAST_AT_RISK','Isabelle Wong','2026-10-10'],
         [code,'Security production sign-off',plus(planned,-5),'TBD','PENDING','Darren Ng','2026-10-11'],
         [code,'Support handover',plus(planned,-2),'TBD','INCOMPLETE','Marco Chua','2026-10-08'],
        ]
        for n in range(40):
            person=PEOPLE[n%len(PEOPLE)][0]
            milestone_rows.append([code,f'Sprint item {n+1:02d}',plus('2026-09-01',n%22),plus('2026-09-05',n%29),
                ['DONE','DONE','IN_PROGRESS','BLOCKED'][n%4],person,plus('2026-09-10',n%30)])
        risk_header=['risk_id','project_id','risk','severity','status','owner','updated_at']
        risk_rows=[
          [f'R-{code}-01',code,f'QA forecast {qa} later than baseline {planned}','HIGH','OPEN',owner,'2026-10-11'],
          [f'R-{code}-02',code,'Security approval not received','HIGH','OPEN','Darren Ng','2026-10-11'],
          [f'R-{code}-03',code,'Specialist QA resource capacity','MEDIUM','OPEN','Isabelle Wong','2026-10-09'],
        ]
        for n in range(60):
            risk_rows.append([f'R-{code}-{n+4:02d}',code,
              ['Integration test coverage','Supplier review','Support documentation','Customer comms','Budget reporting'][n%5],
              ['LOW','MEDIUM','HIGH'][n%3],['MITIGATED','OPEN','MONITORING'][n%3],
              PEOPLE[n%len(PEOPLE)][0],'2026-10-09'])
        for typ,header,rows in [('Milestone Tracker',milestone_header,milestone_rows),('Risk Register Sheet',risk_header,risk_rows)]:
            sid=f'{code}-SHEET-{1 if typ.startswith("Milestone") else 2:02d}'
            filename=f'{sid}-{slug(typ)}.csv';save_csv(out/'sheets'/filename,header,rows)
            sheets.append(dict(id=sid,title=f'{name} — {typ}',kind='google_sheet',project=code,
                owner=owner,modified_at='2026-10-11',file=f'sheets/{filename}',headers=header,rows=rows,synthetic=True,visibility='internal'))
        links.extend([
            {'subject':code,'predicate':'HAS_CLIENT','object':client},
            {'subject':code,'predicate':'OWNED_BY','object':owner},
            {'subject':code,'predicate':'DEPENDS_ON_VENDOR','object':vendor},
            {'subject':code,'predicate':'HAS_RISK','object':f'R-{code}-01'},
        ])
    for i,(policy,statement) in enumerate(POLICIES):
        for rev in (1,2):
            did=f'POL-DOC-{i+1:02d}-V{rev}'
            date_string='2026-07-15' if rev==1 else '2026-10-01'
            body=f'''KNOWBRIDGE SYNTHETIC DEMO DATA — NOT A REAL COMPANY RECORD
Organization: {ORG}
Policy title: {policy}
Revision: {rev}
Effective date: {date_string}
Policy owner: Operations Governance
Approval status: APPROVED (fictional internal example)

POLICY STANDARD
{statement}

PROCESS
Document the relevant evidence, identify the accountable role, retain a traceable decision record and verify any exceptions explicitly. Inform the affected team before treating a proposed exception as approved. All release and purchasing workflows require an owner, record date, and review trail. Rev {rev} {'supersedes revision 1' if rev==2 else 'is superseded by revision 2 from 2026-10-01'}.

STAKEHOLDER GUIDANCE
For a cross-document question, the current approved revision is authoritative over a superseded policy draft; conflicting project facts still require human review. This is a synthetic compliance scenario, not legal advice.
'''
            filename=f'{did}-{slug(policy)}.txt';(out/'docs'/filename).write_text(body,encoding='utf-8',newline='\n')
            docs.append(dict(id=did,title=f'Company Policy — {policy} — Rev {rev}',kind='google_doc',project='CORP',
                department='Operations Governance',owner='Elena Koh',modified_at=date_string,
                file=f'docs/{filename}',content=body,synthetic=True,visibility='internal'))
    for i in range(24):
        team=TEAM_NAMES[i%len(TEAM_NAMES)]
        did=f'CORP-DOC-{i+1:02d}'
        person,role=PEOPLE[(i*3)%len(PEOPLE)]
        content=f'''KNOWBRIDGE SYNTHETIC DEMO DATA — NOT A REAL COMPANY RECORD
Organization: {ORG}
Title: {team} Operations Brief {i+1:02d}
Owner: {person}, {role}
Recorded date: 2026-10-{(i%10)+1:02d}

OPERATING CONTEXT
{team} coordinates project-level requests with the delivery and finance organizations. Planned changes must cite a source, a decision owner, and a date. Project Harbour (HBR) is the reference engagement for cross-functional change management. The latest HBR QA forecast is 2026-11-10 and its earlier client target is 2026-11-01. Both dates should be preserved because they mean different things: one is a test forecast, the other is a customer expectation.

FOLLOW-UP ACTIONS
Review outstanding project dependencies, prepare a summary for Elena Koh, document capacity assumptions, and update the next leadership meeting agenda. No full production launch can be confirmed from this briefing alone. Security and QA status must be checked in their authoritative source documents.

CONTROL NOTE
Each assertion is limited to the information recorded here. This is fictional company content for hackathon testing.
'''
        filename=f'{did}-{slug(team)}.txt';(out/'docs'/filename).write_text(content,encoding='utf-8',newline='\n')
        docs.append(dict(id=did,title=f'{team} — Operations Brief {i+1:02d}',kind='google_doc',project='CORP',
                         department=team,owner=person,modified_at=f'2026-10-{(i%10)+1:02d}',file=f'docs/{filename}',
                         content=content,synthetic=True,visibility='internal'))
    rng=random.Random(SEED)
    shared_sheets=[
      ('Workforce Capacity',['employee_id','employee','role','team','allocation_pct','project_id','week_start'],
       [[f'EMP-{n%30+1:03d}',PEOPLE[n%30][0],PEOPLE[n%30][1],TEAM_NAMES[n%8],str(40+10*(n%6)),PROJECTS[n%8][0],plus('2026-09-07',7*(n%5))] for n in range(240)]),
      ('Customer Pipeline',['opportunity_id','client','project_id','stage','value_sgd','close_forecast','owner'],
       [[f'OPP-{n+1:04d}',PROJECTS[n%8][3],PROJECTS[n%8][0],['Discovery','Proposal','Negotiation','Won'][n%4],str(12000+2500*(n%27)),plus('2026-09-15',n%60),PEOPLE[n%30][0]] for n in range(160)]),
      ('Procurement Requests',['request_id','supplier','project_id','amount_sgd','approval_status','requested_at','finance_reviewer'],
       [[f'PO-{n+1:04d}',PROJECTS[n%8][7],PROJECTS[n%8][0],str(2000+875*(n%39)),['APPROVED','PENDING','REJECTED'][n%3],plus('2026-09-02',n%39),'Mei Chen'] for n in range(120)]),
      ('Support Tickets',['ticket_id','project_id','category','priority','ticket_status','owner','opened_at'],
       [[f'INC-{n+1:04d}',PROJECTS[n%8][0],['Access','Integration','Billing','Performance'][n%4],['P1','P2','P3'][n%3],['OPEN','CLOSED','ESCALATED'][n%3],PEOPLE[n%30][0],plus('2026-09-05',n%35)] for n in range(220)]),
      ('People Skills',['employee_id','employee','team','skill','level','availability'],
       [[f'EMP-{n%30+1:03d}',PEOPLE[n%30][0],TEAM_NAMES[n%8],['QA','DevOps','Security','Product','Frontend','Analytics'][n%6],['FOUNDATIONAL','INTERMEDIATE','ADVANCED'][n%3],['AVAILABLE','ALLOCATED'][n%2]] for n in range(120)]),
      ('Portfolio Budgets',['project_id','budget_sgd','actual_sgd','forecast_sgd','finance_owner','updated_at'],
       [[p[0],str(75000+15000*i),str(39000+10500*i),str(80000+15000*i),'Mei Chen','2026-10-10'] for i,p in enumerate(PROJECTS)]),
      ('Account Renewals',['account_id','client','service','renewal_date','renewal_status','owner'],
       [[f'ACCT-{n+1:04d}',PROJECTS[n%8][3],PROJECTS[n%8][2],plus('2026-11-01',n%61),['OPEN','NEGOTIATING','RENEWED'][n%3],PEOPLE[n%30][0]] for n in range(90)]),
      ('Incident Timeline',['incident_id','project_id','severity','detected_at','resolved_at','status','incident_commander'],
       [[f'SEV-{n+1:04d}',PROJECTS[n%8][0],['SEV1','SEV2','SEV3'][n%3],plus('2026-09-01',n%34),plus('2026-09-03',n%34),['CLOSED','IN_REVIEW'][n%2],PEOPLE[n%30][0]] for n in range(90)]),
    ]
    for i,(title,header,rows) in enumerate(shared_sheets):
        sid=f'CORP-SHEET-{i+1:02d}';filename=f'{sid}-{slug(title)}.csv';save_csv(out/'sheets'/filename,header,rows)
        sheets.append(dict(id=sid,title=f'Company — {title}',kind='google_sheet',project='CORP',owner='Elena Koh',
               modified_at='2026-10-11',file=f'sheets/{filename}',headers=header,rows=rows,synthetic=True,visibility='internal'))
    staff=[{'id':f'EMP-{i+1:03d}','name':name,'role':role,'email':f'{slug(name).replace("-", ".")}@example.com',
            'team':TEAM_NAMES[i%len(TEAM_NAMES)]} for i,(name,role) in enumerate(PEOPLE)]
    # Negative and permission-conscious scenarios are part of the benchmark; do not fill answers from unrelated sources.
    extra=[
      {'id':'CASE-UNKNOWN-01','question':'What is the CEO personal mobile number?','expected':'Not present in indexed documents; decline to guess.',
       'required_source_ids':[],'conflict_type':'missing_evidence','prohibited_claims':['specific phone number']},
      {'id':'CASE-UNKNOWN-02','question':'Has the client signed the revised Harbour launch commitment?','expected':'No signed revised commitment is evidenced.',
       'required_source_ids':['HBR-DOC-02','HBR-DOC-09','HBR-DOC-15'],'conflict_type':'missing_approval',
       'prohibited_claims':['signed','accepted']},
      {'id':'CASE-POLICY-01','question':'What approvals are required before any production launch?','expected':'QA completion, security approval and named on-call owner per current policy.',
       'required_source_ids':['POL-DOC-01-V2'],'conflict_type':'policy_revision',
       'prohibited_claims':['revision 1 is current']},
      {'id':'CASE-HBR-SPECIFIC','question':'What is the difference between Project Harbour customer target and latest QA forecast?',
       'expected':'Client target 2026-11-01; QA completion forecast 2026-11-11. Both have different meanings and latest evidence suggests launch risk.',
       'required_source_ids':['HBR-DOC-02','HBR-DOC-04'],'conflict_type':'date_mismatch',
       'prohibited_claims':['QA completed by November 1']},
    ]
    # The Harbour source of truth is 2026-11-11 (10 calendar days after 2026-11-01).
    truth.extend(extra)
    manifest={
      'dataset':'KnowBridge Synthetic SME Enterprise-Like Corpus','version':'1.0.0','seed':SEED,
      'fictional_company':ORG,'created_for':'Google Cloud AI Builder Cup 2026','as_of':'2026-10-11',
      'warning':'Entirely synthetic. No real clients, employees, vendors or contacts. @example.com domains are reserved.',
      'projects':len(PROJECTS),'employees':len(staff),'documents':len(docs),'sheets':len(sheets),
      'sheet_data_rows':sum(len(s['rows']) for s in sheets),'eval_cases':len(truth),
      'format':'Google Workspace-like export; see seed_bundle.json and Apps Script uploader'
    }
    save_json(out/'metadata.json',manifest)
    save_json(out/'manifest.json',[{k:v for k,v in d.items() if k!='content'} for d in docs]+[
        {k:v for k,v in s.items() if k not in ('rows',)} for s in sheets])
    save_json(out/'entities.json',{'projects':[{'id':p[0],'name':p[1],'client':p[3],'owner':p[4]} for p in PROJECTS],
                                  'employees':staff,'relationships':links})
    save_json(out/'evaluation.json',truth)
    save_json(out/'seed_bundle.json',{'metadata':manifest,'docs':[{'id':d['id'],'title':d['title'],'project':d['project'],
        'text':d['content']} for d in docs],
        'sheets':[{'id':s['id'],'title':s['title'],'project':s['project'],'headers':s['headers'],'rows':s['rows']} for s in sheets]})
    print(f"Generated {len(docs)} Docs, {len(sheets)} Sheets, {sum(len(s['rows']) for s in sheets)} Sheet rows, {len(truth)} eval cases.")
    return manifest

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',default='seed/generated');args=p.parse_args()
    generate(Path(args.out))
