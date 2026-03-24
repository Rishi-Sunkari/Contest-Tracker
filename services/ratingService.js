const axios = require('axios');
const cheerio = require('cheerio');

async function getLeetCodeRating(username) {
    try {
        const res = await axios.post('https://leetcode.com/graphql', {
            query: `
                query userContestRankingInfo($username: String!) {
                    userContestRanking(username: $username) {
                        attendedContestsCount
                        rating
                        globalRanking
                        totalParticipants
                        topPercentage
                        badge {
                            name
                        }
                    }
                }
            `,
            variables: {
                username: username
            }
        });

        const rating = res.data.data.userContestRanking?.rating;
        return rating ? Math.round(rating) : "Unrated";
    } catch (error) {
        console.error("Error fetching LeetCode rating:", error.message);
        return "Error";
    }
}

async function getRatings(handles) {
    const results = {};

    // Codeforces (official API)
    if (handles.codeforces) {
        try {
            const res = await axios.get(`https://codeforces.com/api/user.info?handles=${handles.codeforces}`);
            results.codeforces = res.data.result[0].rating || "Unrated";
        } catch (err) {
            results.codeforces = "Error";
        }
    }

    // LeetCode (scraping)
    if (handles.leetcode) {
        results.leetcode = await getLeetCodeRating(handles.leetcode);
    }

    // CodeChef (API)
    if (handles.codechef) {
        try {
            const res = await axios.get(`https://codechef-api.vercel.app/handle/${handles.codechef}`);
            results.codechef = res.data.rating || "Unrated";
        } catch (err) {
            results.codechef = "Error";
        }
    }

    // AtCoder (scraping)
    if (handles.atcoder) {
        try {
            const res = await axios.get(`https://atcoder.jp/users/${handles.atcoder}`);
            const $ = cheerio.load(res.data);
            const ratingText = $("table tr:contains('Rating') td").first().text().trim();
            results.atcoder = ratingText || "Unrated";
        } catch (err) {
            results.atcoder = "Error";
        }
    }

    // ToCoder or TopCoder (unsupported)
    if (handles.tocoder) {
        results.tocoder = "Not supported yet";
    }

    return results;
}

module.exports = { getRatings };