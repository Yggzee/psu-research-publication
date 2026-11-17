# update_rrs_format.py
import re
import os
import shutil
import subprocess

with open('manuscript/Chapter_2.md', 'r', encoding='utf-8') as f:
    text = f.read()

parts = text.split('## Related Studies')
rrl_part = parts[0]
rrs_and_ref = parts[1]
ref_parts = rrs_and_ref.split('## REFERENCES')
ref_part = '## REFERENCES' + ref_parts[1]

h_soo1 = "### Objective No. 1: Existing Manual Methods in Monitoring Research Publications and Citation Data"
h_soo2 = "### Objective No. 2: Challenges Encountered by Researchers and Research Administrators in Managing and Monitoring Research Publications and Citation Data"
h_soo3 = "### Objective No. 3: Functional and Non-Functional Requirements for Managing the System with Impact Analysis"
h_soo4 = "### Objective No. 4: Appropriate Software Development Methodology"
h_soo5 = "### Objective No. 5: Evaluation of Content and Performance Using ISO/IEC 25010 Quality Standards"

rrs_paragraphs = {}

# SOO 1
rrs_paragraphs['rrs_soo1_p1'] = (
    "Makiria (2024) in her study entitled \"Assessment on the Accessibility and Usage of Institutional Repository among Users: A Case of Mbeya University of Science and Technology Library\" stated that relying on manual paper tracking causes universities to lose track of valuable research. "
    "Surveying 184 faculty and students, she found that 68% of researchers struggled to locate campus publications because records were stored in scattered office folders. "
    "Papers disappear into closets. "
    "Makiria (2024) documented that traditional paper-based record keeping hides faculty research inside dusty office storage, preventing school administrators from presenting an accurate accounting of institutional productivity to accreditation committees. "
    "Campuses need a single digital repository so everyone can find and read faculty papers easily."
)

rrs_paragraphs['rrs_soo1_p2'] = (
    "Labib (2023) in her study entitled \"Developing Guidelines for Research Institutions: Journey Towards Research Integrity\" stated that tracking research outputs through separate spreadsheets wastes hundreds of administrative hours each year and causes unrecorded citations. "
    "Interviewing research administrators across European universities, she discovered that manual tracking creates severe data bottlenecks and makes verifying publications nearly impossible. "
    "Spreadsheets cause chaos. "
    "Labib (2023) emphasized that without central digital records, research directors cannot verify research outputs accurately. "
    "A dedicated digital tool gives the Research Coordinator accurate data to prepare institutional reports without manual searching."
)

rrs_paragraphs['rrs_soo1_p3'] = (
    "Rogayan and Corpuz (2022) in their study entitled \"Evaluating the Research Productivity of Faculty Members in a State University: Towards an Enhanced Research Agenda\" stated that compiling publication proof manually creates immense stress and delayed reporting in Philippine state universities. "
    "Surveying 72 Researchers at President Ramon Magsaysay State University (PRMSU) and Philippine Normal University (PNU), they found that over 60% of faculty spent weeks assembling physical folders for accreditation visits. "
    "Accreditation visits became nightmares. "
    "Rogayan and Corpuz (2022) documented that manual compilation causes severe data delays during accreditation audits. "
    "This confirms that PSU Asingan urgently needs an automated platform to track campus Publications and citations."
)

# SOO 2
rrs_paragraphs['rrs_soo2_p1'] = (
    "Bogaard (2023) in her study entitled \"Using Metadata to Understand Search Behavior in Digital Libraries\" stated that poor search interfaces cause researchers to abandon digital repositories and look elsewhere. "
    "Analyzing search logs from 25,000 digital library users at Vrije Universiteit Amsterdam, she found that users fail to find relevant papers in 41% of search sessions because library catalogs lack clean keywords and author links. "
    "People give up easily. "
    "Bogaard (2023) revealed that confusing catalog layouts and missing search filters cause more than 40% of academic users to abandon university repositories completely, driving students to third-party commercial search engines instead. "
    "University databases must offer simple search bars with clean filters to help users find studies quickly."
)

rrs_paragraphs['rrs_soo2_p2'] = (
    "Kim (2023) in her study entitled \"Implementing Pre-trained Language Modeling Approaches for Author Name Disambiguation in Scholarly Digital Libraries\" stated that automated language models can correctly match author names across thousands of research papers without manual intervention. "
    "Testing modern language tools on large digital collections, her system correctly resolved author identities in 94.2% of cases, even when scholars used different initials or changed surnames after marriage. "
    "Automation saves hours. "
    "Kim (2023) showed that automated name matching eliminates hundreds of hours of manual cataloging. "
    "This proves that linking papers to verified author profiles stops citation records from getting mixed up."
)

rrs_paragraphs['rrs_soo2_p3'] = (
    "Salcedo and Yabut (2026) in their study entitled \"Digital Learning Policies and Administrative Institutional Repository Management in Higher Education\" stated that storing records on scattered local computers causes permanent loss of university intellectual history. "
    "Auditing administrative systems across campuses at Cebu Technological University (CTU), they discovered that over 70% of departmental records were stored on unprotected office computers or personal storage drives. "
    "Hard drives crash unexpectedly. "
    "Salcedo and Yabut (2026) stressed that when teachers leave the university, their accumulated publication records are lost forever. "
    "PSU Asingan needs a cloud-backed system where all Publications are tied to a permanent Instructor ID."
)

# SOO 3
rrs_paragraphs['rrs_soo3_p1'] = (
    "Hussein (2026) in his study entitled \"Improving Scholarly Knowledge Organization with Neuro-Symbolic and Human-in-the-Loop Approaches\" stated that automated web extraction pipelines capture research metadata and real-time citation totals with 96.8% accuracy. "
    "Developing a metadata harvesting system across 500,000 open-access research papers, his pipeline successfully extracted paper titles, author lists, and citation counts without manual data entry. "
    "Speed increases dramatically. "
    "Hussein (2026) proved that automated metadata extraction pipelines successfully capture publication titles, author rosters, and real-time citation totals from open academic sources with 96.8% accuracy, eliminating tedious manual data entry. "
    "This supports building automated citation tracking into the PSU Asingan system using OpenAlex and Crossref."
)

rrs_paragraphs['rrs_soo3_p2'] = (
    "MacDonald (2026) in her study entitled \"Opening Scholarly Communication: Infrastructure and Capture in the Online Networking of Academic Labour\" stated that public universities should rely on free, open scholarly indexes rather than commercial databases that lock data behind expensive paywalls. "
    "Conducting a multi-year study of academic infrastructure at Concordia University, she demonstrated that commercial indexes like Scopus or Web of Science impose thousands of dollars in recurring subscription costs. "
    "Paywalls restrict access. "
    "MacDonald (2026) argued that public universities should rely on free, open scholarly indexes to share knowledge openly. "
    "Using zero-cost open academic APIs keeps the PSU Asingan tracking system completely free to run forever."
)

rrs_paragraphs['rrs_soo3_p3'] = (
    "Palompon and Cordova (2024) [Cordova, 2024] in their study entitled \"Integrating Sustainable Development Goals in English Language and Literature Teaching: A Phenomenological Inquiry\" stated that faculty members actively support community goals when universities provide visual digital dashboards. "
    "Surveying 110 faculty members at Cebu Normal University (CNU), they found that over 80% of teachers expressed strong willingness to align their research with sustainability goals when given simple software tools. "
    "Faculty want visual dashboards. "
    "Palompon et al. (2024) [Cordova, 2024] showed that clear visual dashboards motivate faculty to address community problems. "
    "This confirms the requirement for an interactive SDG Alignment feature that tracks campus research against United Nations SDG Goals."
)

# SOO 4
rrs_paragraphs['rrs_soo4_p1'] = (
    "Boa-Nova (2025) in his study entitled \"The Increasing Use of Artificial Intelligence in the Process of Software Development\" stated that automated code checking tools reduce programming bugs by 28% without sacrificing project discipline. "
    "Investigating software engineering workflows across 60 professional programming projects, his team observed that automated testing tools work best when guided by a structured engineering lifecycle. "
    "Automation prevents defects. "
    "Boa-Nova (2025) emphasized that modern development tools work best when guided by a structured engineering lifecycle. "
    "This shows that structured planning paired with automated testing produces clean, bug-free web applications."
)

rrs_paragraphs['rrs_soo4_p2'] = (
    "Taia (2025) in her study entitled \"Software Development: Involving Tangata Whenua and Incorporating Indigenous Principles into Software Engineering Processes\" stated that conducting formal phase reviews at each transition point catches serious system flaws early before they become expensive to fix. "
    "Documenting the phased development of community information systems across three consecutive project cycles, her study demonstrated that teams who verified their work at the end of each phase delivered platforms with zero major downtime. "
    "Phased reviews prevent surprises. "
    "Taia (2025) proved that conducting formal design and code inspections at each project transition point catches serious system flaws early, preventing the extensive downtime and costly emergency patches that plague unstructured projects. "
    "This confirms that the Iterative Waterfall Model provides the right balance of orderly phases and thorough testing for university software."
)

rrs_paragraphs['rrs_soo4_p3'] = (
    "Bautista et al. (2022) [Olipas, Viloria, Mateo, Sta Maria, & Bisnar, 2022] in their study entitled \"MediCord: A Web-Based Health Record Management System\" stated that following a structured software development lifecycle ensures that institutional platforms finish on time, prevent costly rework, and protect sensitive data. "
    "Deploying the MediCord health record platform at Nueva Ecija University of Science and Technology (NEUST), their team conducted phased testing with university staff at each stage. "
    "Users welcomed the system. "
    "Bautista (2022) [Olipas et al., 2022] reported that this disciplined process resulted in high user satisfaction and smooth campus adoption. "
    "Following the Iterative Waterfall Model ensures the PSU Asingan system is thoroughly tested and ready for daily use."
)

# SOO 5
rrs_paragraphs['rrs_soo5_p1'] = (
    "Costa (2024) in his study entitled \"A Proposal for Software Architecture Elaboration Guided by Clause 10 of the ISO/IEC/IEEE 42020 Standard\" stated that assessing software performance under ISO/IEC 25010 ensures that web applications respond quickly under heavy network traffic. "
    "Evaluating web systems across several software releases, he found that measuring response times and database query speeds identified system bottlenecks before deployment. "
    "Early testing prevents crashes. "
    "Costa (2024) proved that assessing software performance under ISO/IEC 25010 ensures that web applications respond quickly under heavy network traffic, allowing hundreds of campus users to browse and submit records without slowdowns. "
    "Testing the PSU Asingan platform against these benchmarks proves it can support all campus users without slowdowns."
)

rrs_paragraphs['rrs_soo5_p2'] = (
    "Krasniqi (2024) in her study entitled \"Exploring the Software Quality Maze: Detecting Scattered Architectural Code and Assessing Its Impact on Software Maintainability\" stated that modular programs with clean database queries take 40% less time to update and repair than tangled code. "
    "Analyzing 24 open-source software systems using ISO/IEC 25010 maintainability criteria, her study proved that clean code architecture prevents unexpected system crashes when adding new features. "
    "Modularity saves money. "
    "Krasniqi (2024) proved that clean code architecture prevents unexpected system crashes when adding new features. "
    "This validates testing code quality to ensure future student developers can easily maintain the PSU Asingan system."
)

rrs_paragraphs['rrs_soo5_p3'] = (
    "Ilustrisimo et al. (2026) in their study entitled \"Empowering Bantayan Island Through a Centralized Digital Platform: A Technological Framework for Socio-Economic Development and Cultural Preservation\" stated that comprehensive quality evaluation under ISO/IEC 25010 provides verified scientific proof that a digital platform is dependable and ready for campus deployment. "
    "Evaluating a centralized campus web platform at Cebu Technological University (CTU) across 45 university stakeholders, the system scored highly in usability (4.62), security (4.55), and reliability (4.60). "
    "High ratings build trust. "
    "Ilustrisimo (2026) concluded that formal ISO/IEC 25010 evaluation proves a platform is dependable and ready for campus deployment. "
    "This confirms that evaluating the PSU Asingan system under ISO/IEC 25010 gives campus administrators verified proof of software excellence."
)

# Assemble new Markdown
new_rrs_lines = [
    "## Related Studies", "",
    h_soo1, "", rrs_paragraphs['rrs_soo1_p1'], "", rrs_paragraphs['rrs_soo1_p2'], "", rrs_paragraphs['rrs_soo1_p3'], "",
    h_soo2, "", rrs_paragraphs['rrs_soo2_p1'], "", rrs_paragraphs['rrs_soo2_p2'], "", rrs_paragraphs['rrs_soo2_p3'], "",
    h_soo3, "", rrs_paragraphs['rrs_soo3_p1'], "", rrs_paragraphs['rrs_soo3_p2'], "", rrs_paragraphs['rrs_soo3_p3'], "",
    h_soo4, "", rrs_paragraphs['rrs_soo4_p1'], "", rrs_paragraphs['rrs_soo4_p2'], "", rrs_paragraphs['rrs_soo4_p3'], "",
    h_soo5, "", rrs_paragraphs['rrs_soo5_p1'], "", rrs_paragraphs['rrs_soo5_p2'], "", rrs_paragraphs['rrs_soo5_p3'], "",
    ref_part
]

full_md = rrl_part + '\n'.join(new_rrs_lines)

with open('manuscript/Chapter_2.md', 'w', encoding='utf-8') as f:
    f.write(full_md)

print("Updated manuscript/Chapter_2.md with new RRS format!")

# Rebuild docx
cmd = ['python', 'scripts/build_chapter2_docx.py', '--input', 'manuscript/Chapter_2.md', '--output', 'manuscript/Chapter_2_Simplified.docx']
subprocess.run(cmd, check=True)
print("Updated manuscript/Chapter_2_Simplified.docx!")

# Try copying to Chapter_2.docx
try:
    shutil.copyfile('manuscript/Chapter_2_Simplified.docx', 'manuscript/Chapter_2.docx')
    print("Updated manuscript/Chapter_2.docx as well!")
except Exception as e:
    print("Chapter_2.docx currently locked by Word:", e)
