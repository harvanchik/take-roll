import {legalHeading,legalEffectiveDate,legalBodyText} from '../../../lib/legal-presentation';
import {CurrentYear} from '../../page-enhancements';
import {notFound} from 'next/navigation';
import {legalDocuments,noticeVersion} from '../../../lib/legal-documents';
import LegalLinks from '../../legal-links';
export default async function LegalPage({params}:{params:Promise<{document:string}>}){
 const {document}=await params;if(!Object.hasOwn(legalDocuments,document))notFound();const policy=legalDocuments[document],effective=noticeVersion(document);
 return <div className="legal-page"><header><a className="auth-brand" href="/"><img src="/take-roll-mark.svg" width="30" height="30" alt=""/>Take Roll</a><a href="/events">Open Workspace</a></header><main><h1>{legalHeading(policy.title)}</h1><p className="legal-date">Effective {legalEffectiveDate(effective)} · Jake Harvanchik · Texas</p>{policy.sections.map(s=><section key={s.title}><h2>{legalHeading(s.title)}</h2>{s.text.map((p,i)=><p key={i}>{legalBodyText(p,effective)}</p>)}</section>)}<p><a href="mailto:contact@takeroll.online">contact@takeroll.online</a></p><p><a href="/license.txt">Proprietary License</a></p><p><a href="/third-party-notices.txt">Third-Party Notices</a></p></main><footer><LegalLinks/><p>© <CurrentYear/> Jake Harvanchik. All Rights Reserved.</p></footer></div>;
}

