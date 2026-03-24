const axios = require('axios');
const cheerio = require('cheerio');

// Improved Contest Scraper Function with Better Error Handling
const fetchAllContests = async () => {
    const contestsAll = [];
    const errors = [];

    // --- Codeforces ---
    try {
        console.log('Fetching Codeforces contests...');
        const cfResponse = await axios.get('https://codeforces.com/api/contest.list');
        const cfContests = cfResponse.data.result.filter(contest => 
            contest.phase === 'BEFORE' || contest.phase === 'CODING'
        );
        
        const formattedCF = cfContests.map(contest => {
            const start = new Date(contest.startTimeSeconds * 1000);
            const end = new Date((contest.startTimeSeconds + contest.durationSeconds) * 1000);
            return {
                platform: 'Codeforces',
                name: contest.name,
                startISO: start.toISOString(),
                endISO: end.toISOString(),
                duration: contest.durationSeconds / 60,
                startDisplay: start.toLocaleString(),
                endDisplay: end.toLocaleString(),
                url: `https://codeforces.com/contest/${contest.id}`
            };
        });
        
        contestsAll.push(...formattedCF);
        console.log(`✅ Codeforces: ${formattedCF.length} contests fetched`);
    } catch (error) {
        console.error('❌ Codeforces Error:', error.message);
        errors.push(`Codeforces: ${error.message}`);
    }

    // --- CodeChef ---
    try {
        console.log('Fetching CodeChef contests...');
        const ccResponse = await axios.get('https://www.codechef.com/api/list/contests/all');
        
        const ccContests = [
            ...(ccResponse.data.present_contests || []), 
            ...(ccResponse.data.future_contests || [])
        ];
        
        const formattedCC = ccContests.map(contest => ({
            platform: 'CodeChef',
            name: contest.contest_name,
            startISO: contest.contest_start_date_iso,
            endISO: contest.contest_end_date_iso,
            duration: contest.contest_duration,
            startDisplay: contest.contest_start_date,
            endDisplay: contest.contest_end_date,
            url: `https://www.codechef.com/${contest.contest_code}`
        }));
        
        contestsAll.push(...formattedCC);
        console.log(`✅ CodeChef: ${formattedCC.length} contests fetched`);
    } catch (error) {
        console.error('❌ CodeChef Error:', error.message);
        errors.push(`CodeChef: ${error.message}`);
    }

    // --- AtCoder ---
    try {
        console.log('Fetching AtCoder contests...');
        const atcoderResponse = await axios.get('https://atcoder.jp/contests/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        
        const $atcoder = cheerio.load(atcoderResponse.data);
        const upcomingContestsAtcoder = [];

        $atcoder('#contest-table-upcoming tbody tr').each((index, element) => {
            const tds = $atcoder(element).find('td');
            if (tds.length >= 3) {
                const timeText = $atcoder(tds[0]).text().trim();
                const name = $atcoder(tds[1]).text().trim();
                const url = 'https://atcoder.jp' + $atcoder(tds[1]).find('a').attr('href');
                const duration = $atcoder(tds[2]).text().trim();

                if (timeText && name && duration) {
                    try {
                        const startTime = new Date(timeText);
                        const durationParts = duration.split(':');
                        const durationMinutes = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
                        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

                        upcomingContestsAtcoder.push({
                            platform: 'AtCoder',
                            name,
                            startISO: startTime.toISOString(),
                            endISO: endTime.toISOString(),
                            duration: durationMinutes,
                            startDisplay: startTime.toLocaleString(),
                            endDisplay: endTime.toLocaleString(),
                            url
                        });
                    } catch (parseError) {
                        console.error('AtCoder parsing error for row:', timeText, name, duration);
                    }
                }
            }
        });
        
        contestsAll.push(...upcomingContestsAtcoder);
        console.log(`✅ AtCoder: ${upcomingContestsAtcoder.length} contests fetched`);
    } catch (error) {
        console.error('❌ AtCoder Error:', error.message);
        errors.push(`AtCoder: ${error.message}`);
    }

    // --- LeetCode ---
    try {
        console.log('Fetching LeetCode contests...');
        const leetcodeQuery = `
            query {
                allContests {
                    title
                    startTime
                    duration
                    titleSlug
                }
            }
        `;
        
        const leetcodeResponse = await axios.post('https://leetcode.com/graphql', 
            { query: leetcodeQuery },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            }
        );

        if (leetcodeResponse.data.errors) {
            throw new Error('GraphQL query failed: ' + JSON.stringify(leetcodeResponse.data.errors));
        }

        const now = new Date();
        const contests = leetcodeResponse.data.data?.allContests || [];

        const leetcodeFiltered = contests.filter(contest => {
            const start = new Date(contest.startTime * 1000);
            const end = new Date(start.getTime() + contest.duration * 1000);
            return now < end;
        });

        const formattedLC = leetcodeFiltered.map(contest => {
            const startTime = new Date(contest.startTime * 1000);
            const durationMinutes = contest.duration / 60;
            const endTime = new Date(startTime.getTime() + contest.duration * 1000);

            return {
                platform: 'LeetCode',
                name: contest.title,
                startISO: startTime.toISOString(),
                endISO: endTime.toISOString(),
                duration: durationMinutes,
                startDisplay: startTime.toLocaleString(),
                endDisplay: endTime.toLocaleString(),
                url: `https://leetcode.com/contest/${contest.titleSlug}/`
            };
        });
        
        contestsAll.push(...formattedLC);
        console.log(`✅ LeetCode: ${formattedLC.length} contests fetched`);
    } catch (error) {
        console.error('❌ LeetCode Error:', error.message);
        errors.push(`LeetCode: ${error.message}`);
    }

    console.log(`
📊 SUMMARY: ${contestsAll.length} total contests fetched`);
    return contestsAll;
};

module.exports = { fetchAllContests };