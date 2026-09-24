export default async function handler(req, res) {
  const checkedAt = new Date().toISOString();

  const source = {
    name: "APHA Science Blog - Bee Health",
    organisation: "Animal and Plant Health Agency",
    url: "https://aphascience.blog.gov.uk/category/bee-health/",
    feed: "https://aphascience.blog.gov.uk/category/bee-health/feed/"
  };

  try {
    const response = await fetch(source.feed, {
      headers: {
        "User-Agent": "Hornet Alert UK/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}`);
    }

    const xml = await response.text();

    const keywords = [
      "yellow-legged hornet",
      "yellow legged hornet",
      "asian hornet",
      "vespa velutina"
    ];

    const decode = (text = "") =>
      text
        .replace(/<!\[CDATA\[|\]\]>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#8211;|&#x2013;/g, "–")
        .replace(/&#8217;|&#x2019;/g, "'")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const entries = xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];

    const hornetArticles = entries
      .map(entry => {
        const title =
          entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";

        const link =
          entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || "";

        const published =
          entry.match(/<published>([\s\S]*?)<\/published>/i)?.[1] ||
          entry.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ||
          "";

        const content =
          entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ||
          entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
          "";

        const cleanTitle = decode(title);
        const cleanContent = decode(content);

        const searchable =
          `${cleanTitle} ${cleanContent}`.toLowerCase();

        const matchedKeywords = keywords.filter(keyword =>
          searchable.includes(keyword)
        );

        return {
          title: cleanTitle,
          published,
          url: link,
          matchedKeywords
        };
      })
      .filter(article => article.matchedKeywords.length > 0);

    return res.status(200).json({
      ok: true,
      service: "Hornet Alert UK",
      checkedAt,
      source: {
        name: source.name,
        organisation: source.organisation,
        url: source.url,
        reachable: true
      },
      articlesChecked: entries.length,
      hornetArticlesFound: hornetArticles.length,
      hornetArticles
    });

  } catch (error) {
    return res.status(500).json({
      ok: false,
      service: "Hornet Alert UK",
      checkedAt,
      source,
      error: error.message
    });
  }
}
