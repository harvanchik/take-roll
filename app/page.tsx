import type {Metadata} from 'next';
import RollCall from './roll-call';
import {landingDescription} from '../lib/landing-content';
import {cachedPublicStats} from '../lib/public-stats-cache';
export const dynamic='force-dynamic';
export const metadata:Metadata={title:'TakeRoll — Free Attendance Tracker for Groups & Teams',description:landingDescription,alternates:{canonical:'https://takeroll.online/'},robots:{index:true,follow:true},openGraph:{title:'TakeRoll — Free Attendance Tracker',description:landingDescription,url:'https://takeroll.online/',type:'website',siteName:'Take Roll',images:[{url:'https://takeroll.online/share-card-v1.png',width:1200,height:630,alt:'Take Roll. Keep Track. Attendance for your group.'}]},twitter:{card:'summary_large_image',title:'TakeRoll — Free Attendance Tracker',description:landingDescription,images:['https://takeroll.online/share-card-v1.png']}};
export default async function Home(){return <RollCall publicLanding initialPublicStats={await cachedPublicStats()}/>;}
