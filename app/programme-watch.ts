import type {FundingCall} from './calls-data.ts';
import {dateOnly, realStatus, stale} from './call-utils.ts';
export type Round = {key:string; title:string; url:string; checkedAt:string; openDate:string; deadline:string; preDeadline:string;
  applicants?:string; companyScale?:string[]; conflict?:boolean; notCurrent?:boolean; conditionsChangedAt?:string; noticeUrls?:string[]; changes?:{field:string;before:string;after:string}[]};
export function applyRounds(calls:FundingCall[], rows:Round[], now:number):FundingCall[] {
  const result=new Map(calls.map(c=>[c.id,c]));
  for(const r of rows){
    if(!/^(1501|1507|1707|1832)-20\d\d-[1-9]$/.test(r.key) || !/^https:\/\/tubitak\.gov\.tr\/sites\/default\/files\/[^?#]+\.pdf$/i.test(r.url))continue;
    const id='tubitak-'+r.key, calId='tubitak-calendar-'+r.key;
    const previous=result.get(id)??result.get(calId);
    result.delete(calId);
    const base:FundingCall=previous??{
      id,title:r.title,code:r.key,scope:'national',institution:'TÜBİTAK · TEYDEB',institutionShort:'TÜBİTAK',
      status:'unknown',openDate:'',sourceUrl:r.url,sourceLabel:'Resmî dönem belgesi',verifiedAt:'',verification:'metadata',applicants:'Henüz doğrulanmadı',
      companyScale:[],fundingAmount:'Henüz doğrulanmadı',fundingType:'Henüz doğrulanmadı',summary:'Dönem belgesinden alınan başvuru takvimi.',
      application:'Başvuru adımlarını resmî dönem belgesinden kontrol edin.',objectives:[],eligibleCosts:[],tags:['Resmî dönem belgesi'],
    };
    if(r.conflict || r.notCurrent || stale(r.checkedAt,now)){
      const reason=r.conflict?'Resmî dönem belgesi ve takvim arasında fark var.':'Dönem belgesi son kontrolde doğrulanamadı.';
      if(!r.conflict && previous && realStatus(previous,now)==='archived'){result.set(id,{...previous,id});continue}
      result.set(id,{...base,id,status:'unknown',verificationIssues:[...(base.verificationIssues??[]),{field:'deadline',message:reason}]});
      continue;
    }
    const changed=!!r.changes?.length;
    const safeText=(v?:string)=>changed && v && /\d{1,2}[./]\d{1,2}[./]20\d\d|\d{1,2}\s+(ocak|şubat|mart|nisan|mayıs|haziran|temmuz|ağustos|eylül|ekim|kasım|aralık)/i.test(v)?undefined:v;
    const call:FundingCall={...base,id,recordType:'call',status:'open',openDate:r.openDate,preDeadline:r.preDeadline,deadline:r.deadline,
      calendarDateOnly:dateOnly(r.deadline),openingDateOnly:dateOnly(r.openDate),deadlines:undefined,
      application:safeText(base.application)??'Güncel takvim için dönem belgesini inceleyin.',notice:safeText(base.notice),
      calendarObservation:undefined,sourceCheckedAt:r.checkedAt,dateCheckedAt:r.checkedAt,
      scheduleEvidence:{url:r.url,checkedAt:r.checkedAt,changes:r.changes??[],noticeUrls:r.noticeUrls},
      evidenceUrl:base.evidenceUrl??r.url,
      ...(!base.applicantGroups?.length && r.applicants && {applicants:r.applicants,applicantGroups:['Özel sektör'],companyScale:r.companyScale??[]}),
      verifiedFields:[...new Set([...(base.verifiedFields??[]),'openDate','deadline',...(r.applicants?['applicants']:[]),...(r.companyScale?.length?['companyScale']:[])])]};
    if(r.conditionsChangedAt && !(Date.parse(base.verifiedAt)>=Date.parse(r.conditionsChangedAt))){
      const pending='Dönem belgesi değişti; güncel koşul henüz doğrulanmadı.';
      Object.assign(call,{fundingAmount:pending,fundingType:pending,supportRate:undefined,duration:undefined,
        applicants:r.applicants??pending,companyScale:r.companyScale??[],applicantGroups:r.applicants?['Özel sektör']:[],
        evidencePending:true,eligibleCosts:[],application:'Güncel dönem belgesini inceleyin.',notice:pending,
        verifiedFields:['openDate','deadline',...(r.applicants?['applicants']:[]),...(r.companyScale?.length?['companyScale']:[])]});
    }
    result.set(id,{...call,status:realStatus(call,now)});
  }
  return [...result.values()];
}
