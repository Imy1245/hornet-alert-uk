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

    const hornetTerms = [
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

    const articles = entries
      .map(entry => {
        const titleRaw =
          entry.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";

        const link =
          entry.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] || "";

        const published =
          entry.match(/<published>([\s\S]*?)<\/published>/i)?.[1] ||
          entry.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] ||
          "";

        const contentRaw =
          entry.match(/<content[^>]*>([\s\S]*?)<\/content>/i)?.[1] ||
          entry.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ||
          "";

        const title = decode(titleRaw);
        const content = decode(contentRaw);

        const titleLower = title.toLowerCase();
        const contentLower = content.toLowerCase();

        const titleHornetTerms = hornetTerms.filter(term =>
          titleLower.includes(term)
        );

        const contentHornetTerms = hornetTerms.filter(term =>
          contentLower.includes(term)
        );

        if (
          titleHornetTerms.length === 0 &&
          contentHornetTerms.length === 0
        ) {
          return null;
        }

        let type = "information";
        let priority = "low";

        const combined = `${titleLower} ${contentLower}`;

        if (
          combined.includes("nest found") ||
          combined.includes("nest located") ||
          combined.includes("nest destroyed") ||
          combined.includes("nest removed")
        ) {
          type = "nest";
          priority = "high";
        } else if (
          combined.includes("confirmed sighting") ||
          combined.includes("confirmed sightings") ||
          combined.includes("confirmed report") ||
          combined.includes("confirmed presence")
        ) {
          type = "confirmed-sighting";
          priority = "high";
        } else if (
          combined.includes("sighting") ||
          combined.includes("sightings") ||
          combined.includes("report")
        ) {
          type = "sighting-information";
          priority = "medium";
        }

        return {
          title,
          published,
          url: link,
          type,
          priority,
          hornetInTitle: titleHornetTerms.length > 0,
          matchedKeywords: [
            ...new Set([
              ...titleHornetTerms,
              ...contentHornetTerms
            ])
          ]
        };
      })
      .filter(Boolean)
      .filter(article => article.hornetInTitle);

    const highPriority = articles.filter(
      article => article.priority === "high"
    );

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
      relevantHornetArticles: articles.length,
      highPriorityItems: highPriority.length,
      articles
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
