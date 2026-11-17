import requests
import json

HEADERS = {'User-Agent': 'ResPubResearch/1.0 (mailto:juliusoscar.moreno@gmail.com)'}

def search_topic(label, url):
    print(f"\n==================== {label} ====================")
    r = requests.get(url, headers=HEADERS, timeout=12)
    if r.status_code != 200:
        print(f"Error {r.status_code}")
        return
    results = r.json().get('results', [])
    for w in results:
        doi = w.get('doi')
        title = w.get('title')
        year = w.get('publication_year')
        cites = w.get('cited_by_count')
        venue = (w.get('primary_location') or {}).get('source', {}).get('display_name') if w.get('primary_location') else ''
        best_oa = w.get('best_oa_location') or {}
        pdf_url = best_oa.get('pdf_url')
        authors = [a.get('author', {}).get('display_name') for a in w.get('authorships', [])[:3]]
        author_str = ", ".join(filter(None, authors))
        print(f"Title: {title}")
        print(f"Year: {year} | Authors: {author_str} | Venue: {venue} | Citations: {cites}")
        print(f"DOI: {doi}")
        print(f"PDF: {pdf_url}")
        print("-" * 50)

# Topic 1: Internet, digital connectivity, and scholarly publishing / communication in higher education
url_t1 = "https://api.openalex.org/works?filter=is_oa:true,has_doi:true,type:article,from_publication_date:2018-01-01&search=Internet%20scholarly%20publishing%20higher%20education%20connectivity&per_page=10&sort=relevance_score:desc"
search_topic("Topic 1: Internet & Scholarly Publishing", url_t1)

# Topic 2: Emerging trends in research methodology, AI tools, and automated data processing in academic research
url_t2 = "https://api.openalex.org/works?filter=is_oa:true,has_doi:true,type:article,from_publication_date:2023-01-01&search=artificial%20intelligence%20research%20methodology%20data%20processing%20academic%20integrity&per_page=10&sort=relevance_score:desc"
search_topic("Topic 2: AI Tools & Research Methodology", url_t2)

# Topic 3: Philippine state university journal publishing, peer review, and research management (SUC / non-UP)
url_t3 = "https://api.openalex.org/works?filter=is_oa:true,has_doi:true,type:article&search=Philippine%20state%20university%20research%20productivity%20publication%20management&per_page=10&sort=relevance_score:desc"
search_topic("Topic 3: Philippine SUC Research Management", url_t3)

# Topic 4: Institutional research office management, manuscript review, and publishing systems
url_t4 = "https://api.openalex.org/works?filter=is_oa:true,has_doi:true,type:article,from_publication_date:2019-01-01&search=institutional%20research%20office%20manuscript%20review%20journal%20publishing%20system&per_page=10&sort=relevance_score:desc"
search_topic("Topic 4: Research Office & Manuscript Review Systems", url_t4)
