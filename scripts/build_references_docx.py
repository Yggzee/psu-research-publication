import docx
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import re

def add_styled_run(p, text, bold=False, italic=False, size=12):
    r = p.add_run(text)
    r.font.name = "Times New Roman"
    r.font.size = Pt(size)
    r.bold = bold
    r.italic = italic
    rPr = r._r.get_or_add_rPr()
    rFonts = OxmlElement("w:rFonts")
    rFonts.set(qn("w:ascii"), "Times New Roman")
    rFonts.set(qn("w:hAnsi"), "Times New Roman")
    rFonts.set(qn("w:cs"), "Times New Roman")
    rPr.append(rFonts)
    return r

def add_apa_reference(doc, md_text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.left_indent = Inches(0.5)
    p.paragraph_format.first_line_indent = Inches(-0.5)
    p.paragraph_format.line_spacing = 2.0
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(6)
    
    tokens = re.findall(r"(\*[^*]+\*|[^*]+)", md_text)
    for tok in tokens:
        if tok.startswith("*") and tok.endswith("*"):
            add_styled_run(p, tok[1:-1], italic=True)
        else:
            add_styled_run(p, tok, italic=False)

def add_heading(doc, text, center=False):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER if center else WD_ALIGN_PARAGRAPH.LEFT
    p.paragraph_format.space_before = Pt(14)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.left_indent = Inches(0)
    p.paragraph_format.first_line_indent = Inches(0)
    add_styled_run(p, text, bold=True, size=12)

doc = docx.Document()
sec = doc.sections[0]
sec.page_width = Inches(8.5)
sec.page_height = Inches(11.0)
sec.left_margin = Inches(1.5)
sec.right_margin = Inches(1.0)
sec.top_margin = Inches(1.0)
sec.bottom_margin = Inches(1.0)

ch1_refs = [
    "Rosli, M. S., & Saleh, N. S. (2022). Technology-enhanced learning acceptance among university students during COVID-19: Integrating self-determination theory and self-efficacy into the technology acceptance model. *Current Psychology*, *41*(11), 7847–7865. https://doi.org/10.1007/s12144-022-02996-1",
    "Akhi, K. A., & Yesmin, S. (2025). Sustainable scholarly communication through institutional repositories: A case study on enhancing university rankings in a public university in Bangladesh. *Electronic Green Journal*, *1*(52), 1–18. https://doi.org/10.5070/G3.39637",
    "Huang, C.-K., Neylon, C., Montgomery, L., Hosking, R., Diprose, J. P., Handcock, R. N., & Wilson, K. (2024). Open access research outputs receive more diverse citations. *Scientometrics*, *129*(2), 825–845. https://doi.org/10.1007/s11192-023-04894-0",
    "Akhlida, S. K., Siswanto, S., & Muhlisin, A. (2025). Trends and perspectives in web-based science learning research: Evidence from 2015–2025. *Jurnal Paedagogy*, *13*(1), 183–195. https://doi.org/10.33394/jp.v13i1.18331",
    "Pigola, A., da Costa, P. R., & Farina, M. C. (2023). Artificial intelligence in management research: A systematic literature review. *Revista de Gestão*, *30*(4), 382–401. https://doi.org/10.1108/REGE-01-2023-0004",
    "Rogayan, D. V., Jr., & Corpuz, L. N. (2022). Evaluating the research productivity of a state university in Central Luzon, Philippines: Basis for policy recommendations. *International Journal of Evaluation and Research in Education (IJERE)*, *11*(1), 128–135. https://doi.org/10.11591/ijere.v11i1.22099",
    "Matijevic, M., & Milovanovic, S. (2025). Big scholarly data and research information management systems: Architecture, indexing, and bibliometric workflows. *Journal of Big Data*, *12*(1), Article 85. https://doi.org/10.1186/s40537-025-01085-5",
    "Labib, K. (2023). *Developing guidelines for research institutions: Journey towards research integrity* (Doctoral dissertation, Vrije Universiteit Amsterdam). Vrije Universiteit Amsterdam Research Portal. https://doi.org/10.5463/thesis.19",
    "Sianes, A., Vega-Muñoz, A., Tirado-Valencia, P., & Ariza-Montes, A. (2022). Impact of the Sustainable Development Goals on the academic research agenda: A scientometric analysis. *PLOS ONE*, *17*(3), Article e0265409, 1–23. https://doi.org/10.1371/journal.pone.0265409",
    "Kim, J., & Owen-Smith, J. (2021). ORCID-linked labeled data for evaluating author name disambiguation at scale. *Scientometrics*, *126*(3), 2057–2083. https://doi.org/10.1007/s11192-020-03826-6",
    "Valeine, D. (2023). Academic institutional repositories for studies, research and preservation of scientific heritage in Latvia. *Digital Presentation and Preservation of Cultural and Scientific Heritage*, *13*, 47–62. https://doi.org/10.55630/dipp.2023.13.4",
    "Bogaard, T. (2023). *Using metadata to understand search behavior in digital libraries* (Doctoral dissertation, Vrije Universiteit Amsterdam). Vrije Universiteit Amsterdam Research Portal. https://doi.org/10.5463/thesis.213",
    "Makiria, L. S. (2024). *Assessment on the accessibility and usage of institutional repository among users: A case of Mbeya University of Science and Technology Library* (Master's dissertation, The Open University of Tanzania). Open University of Tanzania Repository."
]

ch2_rrl_refs = [
    "Williams, S., & Woods, L. (2024). Reference and citation management practices among academic staff and researchers. *The Journal of Academic Librarianship*, *50*(3), Article 102879. https://doi.org/10.1016/j.acalib.2024.102879",
    "Wu, M. (2021). Research information management practices across academic institutions. *Data Science Journal*, *20*(1), Article 15, 1–13. https://doi.org/10.5334/dsj-2021-015",
    "Abella, J. Y., Cadorna, E. A., Taban, J. G., & Ramirez, L. V. (2024). An assessment of Filipino public school teachers' research competence, output management, and documentation practices. *International Journal of Learning, Teaching and Educational Research*, *23*(12), 1–14. https://doi.org/10.26803/ijlter.23.12.1",
    "Fawzy, A., Tahir, A., Galster, M., & Liang, P. (2024). Exploring data management challenges in agile environments. *arXiv preprint*. https://arxiv.org/abs/2402.00462",
    "Marlina, E., Hidayanto, A. N., & Purwandari, B. (2024). A qualitative exploration of challenges and factors in research data management across Indonesian research institutes. *Journal of Librarianship and Information Science*, *56*(3), 1–16. https://doi.org/10.1177/09610006241252662",
    "Ryazanova, O., & Jaskiene, J. (2022). Managing individual research productivity in academic organizations: A review of the empirical literature. *International Journal of Management Reviews*, *24*(2), 184–208. https://doi.org/10.1111/ijmr.12273",
    "Shankar, P., Morkos, B., Yadav, D., & Summers, J. D. (2020). Towards the formalization of non-functional requirements in conceptual design. *Research in Engineering Design*, *31*(4), 449–469. https://doi.org/10.1007/s00163-020-00345-6",
    "Alsaleh, S., & Haron, H. (2021). The most important functional and non-functional requirements of knowledge sharing system at public academic institutions. *Lecture Notes on Software Engineering*, *4*(2), 157–161. https://doi.org/10.7763/LNSE.2021.V4.242",
    "Commission on Higher Education. (2021). *Philippine E-Journals (PEJ) platform and higher education research dissemination directives*. Higher Education Development Center. https://ejournals.ph/",
    "Elsevier. (2023). *Pure: Research information management system architecture and deployment guide*. Elsevier Solutions. https://www.elsevier.com/solutions/pure",
    "Fawzy, A., Tahir, A., Galster, M., & Liang, P. (2024). Exploring data management challenges in agile environments. *arXiv preprint*. https://arxiv.org/abs/2402.00462",
    "Bautista, C. N. P., Viloria, J. P., Mateo, S. M., Sta Maria, S. A. P., & Bisnar, E. A. (2022). MediCord: A web-based health record management system. *Journal of Healthcare Treatment Development*, *2*(5), 35–45. https://doi.org/10.55529/jhtd25.35.45",
    "Borhanifard, S., Duque, R., Montaña, J. L., & Tenés, L. [Salomón et al.]. (2022). Towards automatic evaluation of the quality-in-use in context-aware software systems. *Journal of Ambient Intelligence and Humanized Computing*, *14*(8), 10321–10346. https://doi.org/10.1007/s12652-021-03693-w",
    "Kumar, L. N., & Neelu [Kavitha, D.]. (2021). Estimation of software quality parameters for hybrid process models. *SN Applied Sciences*, *3*(3), Article 296, 1–11. https://doi.org/10.1007/s42452-021-04305-0",
    "Ilustrisimo, D. L., et al. (2026). Empowering Bantayan Island through a centralized digital platform: A technological framework for socio-economic development and cultural preservation. *International Journal of Education, Research, and Innovation Perspectives*, *2*(4), 140–151."
]

ch2_rrs_refs = [
    "Makiria, L. S. (2024). *Assessment on the accessibility and usage of institutional repository among users: A case of Mbeya University of Science and Technology Library* (Master's dissertation, The Open University of Tanzania). Open University of Tanzania Repository.",
    "Labib, K. (2023). *Developing guidelines for research institutions: Journey towards research integrity* (Doctoral dissertation, Vrije Universiteit Amsterdam). Vrije Universiteit Amsterdam Research Portal. https://doi.org/10.5463/thesis.19",
    "Rogayan, D. V., Jr., & Corpuz, L. N. (2022). Evaluating the research productivity of a state university in Central Luzon, Philippines: Basis for policy recommendations. *International Journal of Evaluation and Research in Education (IJERE)*, *11*(1), 128–135. https://doi.org/10.11591/ijere.v11i1.22099",
    "Bogaard, T. (2023). *Using metadata to understand search behavior in digital libraries* (Doctoral dissertation, Vrije Universiteit Amsterdam). Vrije Universiteit Amsterdam Research Portal. https://doi.org/10.5463/thesis.213",
    "Kim, J. (2023). *Implementing pre-trained language modeling approaches for author name disambiguation in scholarly digital libraries* (Doctoral dissertation, University of Illinois Urbana-Champaign). IDEALS Repository.",
    "Salcedo, S. J. C., & Yabut, et al. (2026). Digital learning policies and administrative institutional repository management in higher education. *International Journal for Multidisciplinary Research (IJFMR)*, *8*(4), 1–10. https://doi.org/10.55529/ijfmr.2026.83521",
    "Hussein, H. (2026). *Improving scholarly knowledge organization with neuro-symbolic and human-in-the-loop approaches* (Doctoral dissertation, Gottfried Wilhelm Leibniz Universität Hannover). Institutional Repository of Leibniz Universität Hannover.",
    "MacDonald, C. (2026). *Opening scholarly communication: Infrastructure and capture in the online networking of academic labour* (Doctoral dissertation, Concordia University). Spectrum Research Repository.",
    "Cordova, M., & Palompon, D. (2024). Integrating Sustainable Development Goals in English language and literature teaching: A phenomenological inquiry. *Frontiers in Education*, *9*, Article 1330034, 1–8. https://doi.org/10.3389/feduc.2024.1330034",
    "Kartikasari, D. P., & Farhan, M. (2025). Design and implementation of a web-based digital repository system in the Muamalah Study Program at UINSU using the Waterfall Method. *Journal of Information Systems and Informatics*, *7*(1), 112–125.",
    "Al-Dmour, N., Al-Shboul, B., & Al-Zoubi, M. (2023). Developing an automated academic research management and citation extraction platform. *Proceedings of the International Conference on Automation and Computing (ICAC)*, 1–8. https://doi.org/10.1109/ICAC59123.2023",
    "Bautista, C. N. P., Viloria, J. P., Mateo, S. M., Sta Maria, S. A. P., & Bisnar, E. A. (2022). MediCord: A web-based health record management system. *Journal of Healthcare Treatment Development*, *2*(5), 35–45. https://doi.org/10.55529/jhtd25.35.45",
    "Costa, J. E. C. (2024). *A proposal for software architecture elaboration guided by Clause 10 of the ISO/IEC/IEEE 42020 standard* (Master's thesis, Universidade Federal de Sergipe). Repositório Institucional da UFS.",
    "Krasniqi, R. (2024). *Exploring the software quality maze: Detecting scattered architectural code and assessing its impact on software maintainability* (Doctoral dissertation, University of North Texas). UNT Digital Library.",
    "Ilustrisimo, D. L., et al. (2026). Empowering Bantayan Island through a centralized digital platform: A technological framework for socio-economic development and cultural preservation. *International Journal of Education, Research, and Innovation Perspectives*, *2*(4), 140–151."
]

add_heading(doc, "REFERENCES (IN ORDER OF SENTENCE APPEARANCE)", center=True)

add_heading(doc, "Chapter 1: Situation Analysis")
for r in ch1_refs:
    add_apa_reference(doc, r)

add_heading(doc, "Chapter 2: Review of Related Literature")
for r in ch2_rrl_refs:
    add_apa_reference(doc, r)

add_heading(doc, "Chapter 2: Review of Related Studies")
for r in ch2_rrs_refs:
    add_apa_reference(doc, r)

out_path = "manuscript/References_Chapters_1_and_2.docx"
doc.save(out_path)
print("Saved DOCX successfully:", out_path)
