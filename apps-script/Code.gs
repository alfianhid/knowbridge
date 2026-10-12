/**
 * KNOWBRIDGE SYNTHETIC WORKSPACE SEEDER
 * Apps Script, executed by YOU in a dedicated test Google account.
 * Creates actual Google Docs and Sheets from the generated seed_bundle.json.
 * All characters, organizations, projects and emails are fictional.
 *
 * 1. Upload seed/generated/seed_bundle.json to Drive.
 * 2. Copy its Drive FILE ID below, never its link.
 * 3. Run seedStart() once; authorize Drive, Docs, Sheets, trigger scopes.
 * 4. A one-minute trigger runs batches, stops automatically when complete.
 * 5. Run seedStatus() to see progress. Disable trigger with seedStop().
 */
const BUNDLE_FILE_ID = 'PASTE_YOUR_UPLOADED_SEED_BUNDLE_FILE_ID_HERE';
const BATCH_SIZE = 12; // lower if Apps Script quotas or runtime limits occur
const PROP_FOLDER = 'KNOWBRIDGE_SEED_FOLDER_ID';
const PROP_CURSOR = 'KNOWBRIDGE_SEED_CURSOR';

function seedStart() {
  if (BUNDLE_FILE_ID.startsWith('PASTE_')) throw new Error('Set BUNDLE_FILE_ID first');
  const props=PropertiesService.getScriptProperties();
  const payload=JSON.parse(DriveApp.getFileById(BUNDLE_FILE_ID).getBlob().getDataAsString('UTF-8'));
  if (!payload.docs || !payload.sheets) throw new Error('Malformed seed_bundle.json');
  if (!props.getProperty(PROP_FOLDER)) {
    const folder=DriveApp.createFolder('KnowBridge SYNTHETIC Demo Workspace');
    props.setProperty(PROP_FOLDER,folder.getId());
    props.setProperty(PROP_CURSOR,'0');
  }
  removeSeedTriggers_();
  ScriptApp.newTrigger('seedBatch').timeBased().everyMinutes(1).create();
  seedBatch();
}
function seedBatch() {
  const props=PropertiesService.getScriptProperties();
  const folderId=props.getProperty(PROP_FOLDER);
  if (!folderId) throw new Error('Call seedStart() first');
  const folder=DriveApp.getFolderById(folderId);
  const payload=JSON.parse(DriveApp.getFileById(BUNDLE_FILE_ID).getBlob().getDataAsString('UTF-8'));
  const items=payload.docs.map(d=>({type:'doc',item:d})).concat(payload.sheets.map(s=>({type:'sheet',item:s})));
  let cursor=Number(props.getProperty(PROP_CURSOR)||0);
  let processed=0;
  while(cursor<items.length && processed<BATCH_SIZE){
    const entry=items[cursor];const source=entry.item;
    const title='[KB:'+source.id+'] '+source.title;
    if(!folder.getFilesByName(title).hasNext()){
      if(entry.type==='doc') {
        const doc=DocumentApp.create(title);
        doc.getBody().setText(source.text);
        doc.saveAndClose();
        DriveApp.getFileById(doc.getId()).moveTo(folder);
      } else {
        const ss=SpreadsheetApp.create(title);
        const sh=ss.getSheets()[0];sh.setName('Data');
        const matrix=[source.headers].concat(source.rows);
        const chunk=250;
        for(let p=0;p<matrix.length;p+=chunk){
          const slice=matrix.slice(p,p+chunk);
          sh.getRange(p+1,1,slice.length,source.headers.length).setValues(slice);
        }
        sh.getRange(1,1,1,source.headers.length).setFontWeight('bold');
        sh.setFrozenRows(1);
        SpreadsheetApp.flush();
        DriveApp.getFileById(ss.getId()).moveTo(folder);
      }
    }
    cursor++;processed++;
    props.setProperty(PROP_CURSOR,String(cursor));
  }
  if(cursor>=items.length)removeSeedTriggers_();
  Logger.log('KnowBridge progress: '+cursor+'/'+items.length+' Workspace files. Folder: '+folder.getUrl());
}
function seedStatus(){
  const props=PropertiesService.getScriptProperties();
  const folder=props.getProperty(PROP_FOLDER);
  Logger.log('Processed '+(props.getProperty(PROP_CURSOR)||'0')+'; folder URL '+(folder?DriveApp.getFolderById(folder).getUrl():'not created'));
}
function seedStop(){removeSeedTriggers_();Logger.log('Seeding paused. Call seedStart() to resume.');}
function removeSeedTriggers_(){
  ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='seedBatch').forEach(t=>ScriptApp.deleteTrigger(t));
}
