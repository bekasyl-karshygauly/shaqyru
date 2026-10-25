import {workflowFixture} from '../tests/workflow-fixture.js';
const {app,tables}=workflowFixture();
app.post('/__test/reset',(req,res)=>{for(const [name,rows]of Object.entries(tables))if(name!=='shq_services')rows.length=0;res.json({ok:true})});
app.listen(Number(process.env.PORT)||3110,'127.0.0.1',()=>console.log('Workflow fixture ready'));
