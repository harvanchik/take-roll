import {themeColorScript,themeStartupScript} from '../lib/theme';
import {historyStartupScript} from '../lib/history-startup';
import PageEnhancements from './page-enhancements';
import {installedViewportScript} from '../lib/installed-viewport';



import type { Metadata,Viewport } from 'next';
import './fonts.css';
import './globals.css';
import './skin.css';
export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};
const description='Take roll. Keep track. Saved rosters, live collaboration, and a history of every change—all in one shared workspace.';
export const metadata:Metadata={
 metadataBase:new URL('https://takeroll.online'),
 title:'Take Roll · Attendance',description,
 openGraph:{type:'website',locale:'en_US',siteName:'Take Roll',url:'https://takeroll.online/',title:'Take Roll. Keep Track.',description,images:[{url:'https://takeroll.online/share-card-v1.png',width:1200,height:630,type:'image/png',alt:'Take Roll. Keep Track. Saved rosters, live collaboration, and attendance history.'}]},
 twitter:{card:'summary_large_image',title:'Take Roll. Keep Track.',description,images:[{url:'https://takeroll.online/share-card-v1.png',alt:'Take Roll. Keep Track. Attendance for your whole team.'}]},
};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" data-theme="dark" suppressHydrationWarning><head><link rel="manifest" href="/manifest.webmanifest?v=2"/><link rel="icon" type="image/svg+xml" href="/icons/app-icon.svg"/><link rel="icon" type="image/png" sizes="32x32" href="/icons/favicon-32.png"/><link rel="icon" type="image/png" sizes="16x16" href="/icons/favicon-16.png"/><link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png?v=2"/><link rel="apple-touch-icon" sizes="167x167" href="/icons/apple-touch-icon-167.png"/><link rel="apple-touch-icon" sizes="152x152" href="/icons/apple-touch-icon-152.png"/><meta name="msapplication-TileColor" content="#101c2a"/><meta name="msapplication-TileImage" content="/icons/icon-512.png?v=2"/><script dangerouslySetInnerHTML={{__html:installedViewportScript}}/><meta name="apple-mobile-web-app-capable" content="yes"/><meta name="mobile-web-app-capable" content="yes"/><meta name="apple-mobile-web-app-title" content="Take Roll"/><meta name="apple-mobile-web-app-status-bar-style" content="default"/><meta name="theme-color" content="#101c2a"/><script dangerouslySetInnerHTML={{__html:historyStartupScript+themeStartupScript+"try{document.documentElement.dataset.sidebar=window.matchMedia('(max-width: 760px)').matches||localStorage.getItem('roll-call-sidebar')==='hidden'?'hidden':'visible';const width=Number(localStorage.getItem('roll-call-sidebar-width'));if(width>=180&&width<=360)document.documentElement.style.setProperty('--sidebar-width',width+'px')}catch(e){}"+themeColorScript}}/></head><body>{children}<PageEnhancements/></body></html>;}

