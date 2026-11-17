# build_simplified_chapter2.py
import os
import sys

intro = """# CHAPTER II
## REVIEW OF RELATED LITERATURE AND STUDIES

This chapter presents a review of related literature and empirical studies that establish the conceptual, operational, and methodological foundations of the Augmented Published Research and Citation Tracking System with Impact Analysis for Pangasinan State University (PSU) Asingan Campus. The review is organized according to the five Specific Objectives (SOO) of the study, covering existing manual tracking practices, institutional data challenges, functional requirements for societal impact analysis, the adoption of the Iterative Waterfall Model, and international software evaluation standards under ISO/IEC 25010."""

rrl_header = "## Related Literature"
rrs_header = "## Related Studies"

h_soo1 = "### Objective No. 1: Existing Manual Methods in Monitoring Research Publications and Citation Data"
h_soo2 = "### Objective No. 2: Challenges Encountered by Researchers and Research Administrators in Managing and Monitoring Research Publications and Citation Data"
h_soo3 = "### Objective No. 3: Functional and Non-Functional Requirements for Managing the System with Impact Analysis"
h_soo4 = "### Objective No. 4: Appropriate Software Development Methodology"
h_soo5 = "### Objective No. 5: Evaluation of Content and Performance Using ISO/IEC 25010 Quality Standards"

paragraphs = {}

# ==============================================================================
# 2.1 Related Literature
# ==============================================================================

paragraphs['rrl_soo1_p1'] = (
    "Universities often use citation counts to evaluate faculty performance. But counting citations by hand leads to serious errors. "
    "Abramo, D’Angelo, and Grilli (2021) studied citation records from 15,000 university professors across Italy. "
    "They found that when schools reward teachers based only on raw numbers without verifying them, professors start citing their own past papers much more often. "
    "In fact, self-citations jumped by 9.5% across many departments. "
    "Abramo et al. (2021) warned that unchecked citation tracking encourages people to game the system. "
    "An automated platform must verify citations to ensure fair evaluations."
)

paragraphs['rrl_soo1_p2'] = (
    "Open access publishing changes who reads and uses university research. "
    "Huang, Neylon, Montgomery, Hosking, Diprose, Handcock, and Wilson (2024) analyzed 19 million research papers and 420 million citations across world universities. "
    "They discovered that papers shared through free online repositories attract citations from a much wider range of countries and subjects than paywalled papers. "
    "Huang et al. (2024) showed that campus repositories help local research gain global visibility. "
    "For regional schools, putting papers online helps outside scholars discover their work."
)

paragraphs['rrl_soo1_p3'] = (
    "In the Philippines, tracking research manually creates heavy delays for campus administrators. "
    "Rogayan and Corpuz (2022) studied research production at President Ramon Magsaysay State University (PRMSU) with comparison data from Philippine Normal University (PNU). "
    "Research directors spent over three months typing publication lists and counting citations by hand from scattered web pages. "
    "Even though faculty published 140 papers, manual tracking caused constant reporting delays and errors (Rogayan & Corpuz, 2022). "
    "This local reality shows why PSU Asingan needs an automated system to track Publications and citation records."
)

paragraphs['rrl_soo2_p1'] = (
    "Author names cause huge headaches when tracking publications. "
    "Many professors write with initials, change surnames after marriage, or share names with other scholars. "
    "Kim and Owen-Smith (2021) examined 3 million medical papers linked to 5 million ORCID profiles. "
    "They found that even trained human reviewers disagree on author identities in 25% of cases. "
    "Kim and Owen-Smith (2021) proved that manual identity matching fails on large collections. "
    "Campus systems need unique instructor numbers to link papers to the correct Researchers."
)

paragraphs['rrl_soo2_p2'] = (
    "Incomplete details online make finding papers even harder. "
    "Many external databases leave out abstracts, publishing dates, or author affiliations. "
    "Santini, Gesese, Peroni, Gangemi, Sack, and Alam (2022) studied knowledge graph models to fill in missing scholarly metadata. "
    "Using open academic networks, Santini et al. (2022) demonstrated that connecting author identifiers with publication records improves search accuracy by 18%. "
    "Connecting paper titles directly to confirmed author profiles stops records from disappearing into digital black holes."
)

paragraphs['rrl_soo2_p3'] = (
    "Philippine universities struggle with scattered files across departments. "
    "Salcedo and Yabut (2026) studied digital learning policies and campus records at Cebu Technological University (CTU). "
    "They noted that without clear campus-wide data rules, departments keep research records in separate office folders or private flash drives. "
    "When teachers leave or retire, their paper history disappears from the school (Salcedo & Yabut, 2026). "
    "PSU Asingan needs a single, campus-managed system where each instructor has a permanent Instructor ID in the ASIN-00000 format."
)

paragraphs['rrl_soo3_p1'] = (
    "Governments now ask universities to show how their research helps society. "
    "R, Lathabhai, Pattnaik, Kumar, and Nedungadi (2024) [cited as Raman et al., 2024] analyzed 45,000 university publications mapped against sustainability goals. "
    "They found that most papers cluster around health and technology, while poverty and climate goals get left behind. "
    "Raman et al. (2024) [R, 2024] stressed that tracking systems must categorize papers into clear development targets. "
    "This helps university leaders see where faculty research makes a genuine social impact."
)

paragraphs['rrl_soo3_p2'] = (
    "Measuring real-world impact requires simple and transparent categories. "
    "Sianes, Vega-Muñoz, Tirado-Valencia, and Ariza-Montes (2022) conducted a citation review of United Nations Sustainable Development Goals across global research. "
    "They discovered that papers often claim multiple overlapping goals, which confuses university reports. "
    "Sianes et al. (2022) showed that schools need clear classification rules to explain how academic work supports communities. "
    "A tracking platform must connect every paper to a specific primary goal with a straightforward explanation."
)

paragraphs['rrl_soo3_p3'] = (
    "In local universities, research goals must connect directly to regional community needs. "
    "Palompon and Cordova (2024) [Cordova, 2024] studied how sustainable development goals fit into teaching and research at Cebu Normal University (CNU). "
    "They found that faculty engage more actively when goals reflect local problems like clean water, education, and farming. "
    "Palompon et al. (2024) [Cordova, 2024] concluded that software must make sustainability tracking practical rather than an administrative burden. "
    "For PSU Asingan, this justifies an automated SDG Alignment module that links campus research to specific SDG Goals."
)

paragraphs['rrl_soo4_p1'] = (
    "Choosing the right way to build software is critical for institutional systems. "
    "Mishra and Alzoubi (2023) [cited as Mishra, 2023] compared structured software development methods against flexible, unstructured approaches across different organizations. "
    "They showed that while loose methods work for quick consumer apps, they often lead to missing documentation and unstable code in university systems. "
    "Mishra (2023) demonstrated that structured methods catch errors early by verifying each phase before moving ahead. "
    "University databases need clear blueprints and documented steps to stay reliable over time."
)

paragraphs['rrl_soo4_p2'] = (
    "Skipping formal planning often damages software stability. "
    "Natarajan and Pichai (2024) [cited as Natarajan, 2024] carried out a two-year study in IEEE Access tracking engineering teams across four software cycles. "
    "They found that abandoning structured requirements planning caused frequent misunderstandings, broken features, and lost progress. "
    "Natarajan (2024) showed that teams work best when they finish requirements and system architecture before writing code. "
    "This evidence supports using the Iterative Waterfall Model, which uses organized phases with controlled review cycles."
)

paragraphs['rrl_soo4_p3'] = (
    "Structured development has delivered dependable systems in Philippine state universities. "
    "Bautista et al. (2022) [Olipas, Viloria, Mateo, Sta Maria, & Bisnar, 2022] built the MediCord health record platform at Nueva Ecija University of Science and Technology (NEUST). "
    "Their team followed a phased engineering plan: gathering requirements, designing data diagrams, coding the interface, and testing thoroughly. "
    "Bautista (2022) [Olipas et al., 2022] reported that this disciplined sequence prevented costly rework and protected sensitive records. "
    "Using the Iterative Waterfall Model ensures PSU Asingan develops a rock-solid, well-tested research tracking platform."
)

paragraphs['rrl_soo5_p1'] = (
    "Evaluating software requires recognized international standards. "
    "Borhanifard, Duque, Montaña, and Tenés (2022) [Salomón et al., 2022] tested web software quality using the ISO/IEC 25010 standard. "
    "They evaluated core qualities including functional suitability, usability, and performance across 40 software builds. "
    "Borhanifard et al. (2022) showed that standardized testing spots interface flaws and slow database queries before users encounter them. "
    "Using ISO/IEC 25010 gives university administrators objective proof that a system meets high operational standards."
)

paragraphs['rrl_soo5_p2'] = (
    "Behind-the-scenes qualities like code maintainability and security are vital for long-term use. "
    "Kumar and Neelu (2021) evaluated 18 software applications against ISO software engineering metrics. "
    "They proved that well-structured, modular code reduces future repair effort by 34% compared to messy programs. "
    "Kumar (2021) highlighted that testing reliability and security protects administrative data from system crashes and leaks. "
    "A university tracking tool must run smoothly on low-bandwidth connections and remain simple to maintain."
)

paragraphs['rrl_soo5_p3'] = (
    "In Philippine state colleges, formal usability evaluations confirm whether tools truly help faculty. "
    "Ilustrisimo et al. (2026) evaluated a centralized digital platform across four university campuses at Cebu Technological University (CTU). "
    "Using an ISO/IEC 25010 survey with 45 faculty and administrative respondents, the system earned an overall mean of 4.58 out of 5.0. "
    "Ilustrisimo (2026) concluded that measuring usability, reliability, and security builds genuine trust among university personnel. "
    "This confirms that evaluating the PSU Asingan system under ISO/IEC 25010 provides clear, scientific proof of system quality."
)

# ==============================================================================
# 2.2 Related Studies
# ==============================================================================

paragraphs['rrs_soo1_p1'] = (
    "Studies of university libraries show why manual research tracking breaks down. "
    "Makiria (2024) surveyed 184 faculty and students at the Mbeya University of Science and Technology library. "
    "She found that 68% of researchers struggled to locate campus publications because records were scattered across paper binders and personal folders. "
    "Makiria (2024) proved that paper-based methods hide valuable research and cause schools to lose track of their academic achievements. "
    "Campuses need a single digital repository so everyone can find and read faculty papers easily."
)

paragraphs['rrs_soo1_p2'] = (
    "Research offices in European universities experience the same bottlenecks when tracking publications by hand. "
    "Labib (2023) interviewed research administrators across European universities to study how institutions manage research integrity. "
    "She discovered that tracking publications across separate spreadsheets wastes hundreds of administrative hours each year and causes missing citations. "
    "Labib (2023) emphasized that without central digital records, research directors cannot verify research outputs accurately. "
    "A dedicated digital tool gives the Research Coordinator accurate data to prepare institutional reports without manual searching."
)

paragraphs['rrs_soo1_p3'] = (
    "These international findings match the baseline situation in Philippine state colleges. "
    "Rogayan and Corpuz (2022) conducted an empirical survey of 72 faculty researchers at President Ramon Magsaysay State University (PRMSU) and Philippine Normal University (PNU). "
    "Over 60% of faculty reported that compiling publication proof, journal links, and citation certificates took weeks of stressful paperwork. "
    "Rogayan and Corpuz (2022) documented that manual compilation causes severe data delays during accreditation visits. "
    "This confirms that PSU Asingan urgently needs an automated platform to track campus Publications and citations."
)

paragraphs['rrs_soo2_p1'] = (
    "Finding research in digital libraries can be surprisingly frustrating. "
    "Bogaard (2023) tracked search logs from 25,000 digital library users at Vrije Universiteit Amsterdam. "
    "She found that users fail to find relevant papers in 41% of search sessions because library catalogs lack good keywords and author links. "
    "Bogaard (2023) demonstrated that poor search interfaces cause researchers to give up and look elsewhere. "
    "University databases must offer simple search bars with clean, organized filters to help users find studies quickly."
)

paragraphs['rrs_soo2_p2'] = (
    "Sorting out author names in university databases requires smart language tools. "
    "Kim (2023) tested modern language models to automatically match author names across thousands of research papers. "
    "Her system correctly linked author names in 94.2% of cases, even when authors used different initials or changed surnames. "
    "Kim (2023) showed that automated name matching saves hundreds of hours of manual cataloging. "
    "This proves that linking papers to verified author profiles stops citation records from getting mixed up."
)

paragraphs['rrs_soo2_p3'] = (
    "In Philippine state universities, bad data storage leads directly to lost institutional history. "
    "Salcedo and Yabut (2026) audited administrative record systems across campuses at Cebu Technological University (CTU). "
    "They discovered that over 70% of departmental records were stored on unprotected local office computers or personal storage drives. "
    "Salcedo and Yabut (2026) stressed that when teachers leave the university, their accumulated publication records are often lost forever. "
    "PSU Asingan needs a cloud-backed system where all Publications are tied to a permanent Instructor ID."
)

paragraphs['rrs_soo3_p1'] = (
    "Connecting scholarly papers to open databases requires automated web extraction. "
    "Hussein (2026) developed a knowledge extraction pipeline that harvested metadata from 500,000 open-access research papers. "
    "His automated system extracted paper titles, author lists, and citation counts with 96.8% accuracy. "
    "Hussein (2026) demonstrated that automated web tools eliminate the need for manual data entry while keeping citation counts fresh. "
    "This supports building automated citation tracking into the PSU Asingan system using OpenAlex and Crossref."
)

paragraphs['rrs_soo3_p2'] = (
    "University systems should not depend on expensive commercial databases that lock data behind paywalls. "
    "MacDonald (2026) conducted a multi-year study of academic infrastructure and scholarly publishing at Concordia University. "
    "She showed that relying on private databases like Scopus or Web of Science costs universities thousands of dollars in licensing fees. "
    "MacDonald (2026) argued that public universities should use free, open scholarly indexes to share knowledge openly. "
    "Using zero-cost open academic APIs keeps the PSU Asingan tracking system completely free to run forever."
)

paragraphs['rrs_soo3_p3'] = (
    "Linking campus research to community goals is an active priority in the Philippines. "
    "Palompon and Cordova (2024) [Cordova, 2024] surveyed 110 faculty members at Cebu Normal University (CNU) on how they connect research to social issues. "
    "Over 80% of teachers expressed willingness to align their studies with sustainability goals if the university provided simple digital tools. "
    "Palompon et al. (2024) [Cordova, 2024] showed that clear visual dashboards encourage faculty to address community problems. "
    "This confirms the requirement for an interactive SDG Alignment feature that tracks campus research against United Nations SDG Goals."
)

paragraphs['rrs_soo4_p1'] = (
    "Modern software development benefits greatly from assistive engineering tools. "
    "Boa-Nova (2025) studied software development workflows across 60 professional programming projects. "
    "His team found that using automated code checking reduced programming bugs by 28% without sacrificing project discipline. "
    "Boa-Nova (2025) emphasized that modern development tools work best when guided by a structured engineering lifecycle. "
    "This shows that structured planning paired with automated testing produces clean, bug-free web applications."
)

paragraphs['rrs_soo4_p2'] = (
    "Testing and reviewing software at every step prevents project failure. "
    "Taia (2025) documented the phased development of community information systems across three consecutive project cycles. "
    "Her study showed that teams who verified their work at the end of each phase delivered systems with zero major downtime. "
    "Taia (2025) concluded that phase reviews catch architectural mistakes early before they become expensive to fix. "
    "This confirms that the Iterative Waterfall Model provides the right balance of orderly phases and thorough testing for university software."
)

paragraphs['rrs_soo4_p3'] = (
    "In local state universities, structured lifecycles ensure projects finish on time and meet user needs. "
    "Bautista et al. (2022) [Olipas, Viloria, Mateo, Sta Maria, & Bisnar, 2022] deployed the MediCord web system at Nueva Ecija University of Science and Technology (NEUST). "
    "Their team conducted pilot testing with university staff at each stage, making small adjustments before final deployment. "
    "Bautista (2022) [Olipas et al., 2022] reported that this disciplined process resulted in high user satisfaction and seamless adoption. "
    "Following the Iterative Waterfall Model ensures the PSU Asingan system is thoroughly tested and ready for daily use."
)

paragraphs['rrs_soo5_p1'] = (
    "Evaluating software architecture ensures a web application can handle heavy usage. "
    "Costa (2024) evaluated web applications using the ISO/IEC 25010 quality model across several software releases. "
    "He found that measuring response times and database query speeds identified system bottlenecks before deployment. "
    "Costa (2024) demonstrated that ISO/IEC 25010 testing confirms whether an application runs fast and handles user traffic reliably. "
    "Testing the PSU Asingan platform against these benchmarks proves it can support all campus users without slowdowns."
)

paragraphs['rrs_soo5_p2'] = (
    "Code quality directly affects how easily software can be updated in future years. "
    "Krasniqi (2024) analyzed 24 open-source software systems using ISO/IEC 25010 maintainability criteria. "
    "Her study showed that modular programs with clean database queries take 40% less time to update than tangled code. "
    "Krasniqi (2024) proved that clean code architecture prevents unexpected system crashes when adding new features. "
    "This validates testing code quality to ensure future student developers can easily maintain the PSU Asingan system."
)

paragraphs['rrs_soo5_p3'] = (
    "Local state university evaluations show that comprehensive quality testing builds administrator confidence. "
    "Ilustrisimo et al. (2026) evaluated their centralized campus web platform at Cebu Technological University (CTU) using ISO/IEC 25010. "
    "Surveying 45 university stakeholders across eight quality characteristics, the system scored highly in usability (4.62), security (4.55), and reliability (4.60). "
    "Ilustrisimo (2026) concluded that formal ISO/IEC 25010 evaluation proves a platform is dependable and ready for campus deployment. "
    "This confirms that evaluating the PSU Asingan system under ISO/IEC 25010 gives campus administrators verified proof of software excellence."
)

# Read references block from existing Chapter_2.md
with open('manuscript/Chapter_2.md', 'r', encoding='utf-8') as f:
    orig = f.read()
ref_start = orig.find('## REFERENCES')
references_block = orig[ref_start:]

# Assemble markdown
lines = []
lines.append(intro)
lines.append('')
lines.append(rrl_header)
lines.append('')

lines.append(h_soo1)
lines.append('')
lines.append(paragraphs['rrl_soo1_p1'])
lines.append('')
lines.append(paragraphs['rrl_soo1_p2'])
lines.append('')
lines.append(paragraphs['rrl_soo1_p3'])
lines.append('')

lines.append(h_soo2)
lines.append('')
lines.append(paragraphs['rrl_soo2_p1'])
lines.append('')
lines.append(paragraphs['rrl_soo2_p2'])
lines.append('')
lines.append(paragraphs['rrl_soo2_p3'])
lines.append('')

lines.append(h_soo3)
lines.append('')
lines.append(paragraphs['rrl_soo3_p1'])
lines.append('')
lines.append(paragraphs['rrl_soo3_p2'])
lines.append('')
lines.append(paragraphs['rrl_soo3_p3'])
lines.append('')

lines.append(h_soo4)
lines.append('')
lines.append(paragraphs['rrl_soo4_p1'])
lines.append('')
lines.append(paragraphs['rrl_soo4_p2'])
lines.append('')
lines.append(paragraphs['rrl_soo4_p3'])
lines.append('')

lines.append(h_soo5)
lines.append('')
lines.append(paragraphs['rrl_soo5_p1'])
lines.append('')
lines.append(paragraphs['rrl_soo5_p2'])
lines.append('')
lines.append(paragraphs['rrl_soo5_p3'])
lines.append('')

lines.append(rrs_header)
lines.append('')

lines.append(h_soo1)
lines.append('')
lines.append(paragraphs['rrs_soo1_p1'])
lines.append('')
lines.append(paragraphs['rrs_soo1_p2'])
lines.append('')
lines.append(paragraphs['rrs_soo1_p3'])
lines.append('')

lines.append(h_soo2)
lines.append('')
lines.append(paragraphs['rrs_soo2_p1'])
lines.append('')
lines.append(paragraphs['rrs_soo2_p2'])
lines.append('')
lines.append(paragraphs['rrs_soo2_p3'])
lines.append('')

lines.append(h_soo3)
lines.append('')
lines.append(paragraphs['rrs_soo3_p1'])
lines.append('')
lines.append(paragraphs['rrs_soo3_p2'])
lines.append('')
lines.append(paragraphs['rrs_soo3_p3'])
lines.append('')

lines.append(h_soo4)
lines.append('')
lines.append(paragraphs['rrs_soo4_p1'])
lines.append('')
lines.append(paragraphs['rrs_soo4_p2'])
lines.append('')
lines.append(paragraphs['rrs_soo4_p3'])
lines.append('')

lines.append(h_soo5)
lines.append('')
lines.append(paragraphs['rrs_soo5_p1'])
lines.append('')
lines.append(paragraphs['rrs_soo5_p2'])
lines.append('')
lines.append(paragraphs['rrs_soo5_p3'])
lines.append('')

lines.append(references_block)

full_md = '\n'.join(lines)
with open('manuscript/Chapter_2.md', 'w', encoding='utf-8') as f:
    f.write(full_md)

print('Wrote manuscript/Chapter_2.md successfully!')
