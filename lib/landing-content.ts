export const landingDescription='TakeRoll is a free attendance tracker for organizations, teams, classes, clubs, and volunteer groups. Manage rosters, meetings, and training with no attendee accounts required.';
export const landingFaqs=[
 {
  "question": "What is TakeRoll?",
  "answer": "TakeRoll is a web application for managing rosters and recording attendance at events and sessions. Organizers add people, mark attendance, and review their records in one place."
 },
 {
  "question": "Who is TakeRoll designed for?",
  "answer": "TakeRoll is for anyone organizing attendance for a group, including workplaces, volunteer programs, classes, clubs, community groups, student organizations, and sports teams. It works for meetings, workshops, activities, and training sessions rather than one particular kind of event."
 },
 {
  "question": "Is TakeRoll free?",
  "answer": "TakeRoll is currently completely free to use. There is no paid plan required to use its current attendance features."
 },
 {
  "question": "Do organizers need an account, or can I use guest mode?",
  "answer": "Organizers can sign in with Google, Microsoft, or ChatGPT to save records to the hosted database, or choose Use without Signing In for guest mode. Guest records stay in local storage in the current browser and are not saved to TakeRoll’s database or synced to other devices. Clearing browser site data can delete those records, and signing in does not automatically upload them. Use a trusted browser and accept the app’s terms before starting."
 },
 {
  "question": "Do attendees need accounts?",
  "answer": "No. Attendees do not need to sign in or create accounts. An organizer creates and manages the roster and records each person’s attendance."
 },
 {
  "question": "How do rosters, events, and subevents work?",
  "answer": "Create a roster, add people individually or in bulk, and use that roster to create an event. Keep multiple rosters and events for different groups or activities, then use subevents for individual meetings or sessions. Each subevent has its own attendance marks, with notes and excuse types available when needed."
 },
 {
  "question": "Can multiple users work in one organization?",
  "answer": "Yes. Organization admins can invite other signed-in users to the same workspace, where they share rosters and events according to their access. Saved changes are delivered live to collaborators, and conflicting edits are flagged for review. Guest mode stays in one browser and does not support shared workspaces or live collaboration."
 },
 {
  "question": "Does TakeRoll work on mobile devices?",
  "answer": "Yes. The interface adapts to smaller screens, with a mobile swipe view and a list view for taking attendance. Organizers can choose swipe actions for attendance statuses or skipping a person."
 },
 {
  "question": "How does it compare with paper sign-in sheets or Google Forms?",
  "answer": "TakeRoll is built around an organizer-managed roster and attendance marks rather than a sheet to pass around or a form each attendee submits. It brings session records, notes, attendance history, and reports into the attendance workflow. Choose the approach that fits how your group checks in."
 },
 {
  "question": "What attendance statuses and reports are supported?",
  "answer": "The default attendance statuses include Present, Bit Late, Tardy, and Absent. Organizers can customize attendance statuses and excuse types and generate visual or text attendance reports for an event. Reports can be copied or downloaded."
 },
 {
  "question": "Can I review and compare individual attendance?",
  "answer": "Yes. A person’s attendance record brings together their history across events and sessions where they are included. You can also compare up to six people’s records and filter the view by dates, rosters, attendance, or excuse types."
 },
 {
  "question": "How is attendance information protected?",
  "answer": "Hosted workspace records require sign-in and workspace membership, and access is checked by the application. Guest records are accessible through the browser profile where they are stored, so use a trusted device. Read the Privacy Policy and Data Processing Terms for details, and avoid adding unnecessary sensitive information."
 }
];
export const softwareApplication={
 '@context':'https://schema.org','@type':'SoftwareApplication','@id':'https://takeroll.online/#application',name:'TakeRoll',alternateName:'Take Roll',url:'https://takeroll.online/',description:landingDescription,applicationCategory:'BusinessApplication',operatingSystem:'Web browser',browserRequirements:'Requires JavaScript for attendance workflows',inLanguage:'en',isAccessibleForFree:true,offers:{'@type':'Offer',price:'0',priceCurrency:'USD'},featureList:['Organizer-managed rosters','Events and subevents','Custom attendance statuses and excuse types','Attendance notes and history','Visual and text reports','Browser-only guest mode','Mobile attendance views','Live organization collaboration']
};

export const websiteIdentity={'@context':'https://schema.org','@type':'WebSite','@id':'https://takeroll.online/#website',url:'https://takeroll.online/',name:'TakeRoll',alternateName:'Take Roll',inLanguage:'en'};
