const functions = require("firebase-functions");
const { Configuration, OpenAIApi } = require("openai");
const cors = require('cors')({origin: true});

const configuration = new Configuration({
    apiKey: "YOUR-API-KEY-HERE",
});
const openai = new OpenAIApi(configuration);

function generateChatPrompt(topic, difficulty, count, reportedQuestionString) {

    let verboseDifficulty = "";
    if (difficulty == "hard") {
        verboseDifficulty = "extremely niche. Someone should need to have a deep knowledge of the subject to answer it.";
    } else if (difficulty == "medium") {
        verboseDifficulty = "challenging but not punishing. Someone with a moderate amount of knowledge on the subject could answer it.";
    } else {
        verboseDifficulty = "easy enough that someone with very little knowledge on the subject could answer it.";
    }

    let verboseReportedQuestionString = "";
    if (reportedQuestionString.length > 1) {
        verboseReportedQuestionString = "Do not use any of the following questions:\n" + reportedQuestionString;
    }

    return [
        {"role": "system", "content": `You are a helpful assistant that creates accurate trivia questions on any topic.`},
        {"role": "user", "content": `Create ${count} trivia questions with one correct answer and three incorrect answers on the topic of ${topic}. Use the following format:

        [Question]What is the name of Sam Neill's character in Jurassic Park (1993)?[/Question]
        [Correct]Alan Grant[/Correct]
        [Wrong1]Ian Malcolm[/Wrong1]
        [Wrong2]Jeff Wright[/Wrong2]
        [Wrong3]John Bell[/Wrong3]
        [Question Separator]

        Ensure that your trivia question is ${verboseDifficulty}

        ${verboseReportedQuestionString}
            `}
    ]
}

function parseByTag(str, openTag, closeTag) {
    str = str.split(closeTag)[0];
    str = str.split(openTag)[1];
    return str;
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;
  
    // While there remain elements to shuffle.
    while (currentIndex != 0) {
  
      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
  
      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }
  
    return array;
}

function parseQuestions(message) {
    let questions = [];
    let stringAsArray = message.split("[Question Separator]");
    stringAsArray.pop();
    console.log("questionArray");
    console.log(stringAsArray);
    for (let i = 0; i < stringAsArray.length; i++) {
        let question = {};
        question.question = parseByTag(stringAsArray[i], '[Question]', '[/Question]');
        question.correctAnswer = parseByTag(stringAsArray[i], '[Correct]', '[/Correct]');
        question.possibleAnswers = [question.correctAnswer, parseByTag(stringAsArray[i], '[Wrong1]', '[/Wrong1]'), parseByTag(stringAsArray[i], '[Wrong2]', '[/Wrong2]'), parseByTag(stringAsArray[i], '[Wrong3]', '[/Wrong3]')];
        question.possibleAnswers = shuffle(question.possibleAnswers);
        questions.push(question);
    }
    return questions;
}

exports.getAIQuestions = functions.https.onRequest((req, res) => {
    return cors(req, res, () => {
        const topic = req.query.topic;
        const difficulty = req.query.difficulty;
        const count = req.query.count;
        const reportedQuestions = req.query.reportedQuestions;
        let reportedQuestionString = "";
        for (const reportedQuestion in reportedQuestions) {
            reportedQuestionString += reportedQuestions[reportedQuestion].question.question;
            reportedQuestionString += "\n";
        }

        console.log("Topic: " + topic);
        console.log("Difficulty: " + difficulty);
        console.log("Count: " + count);
        console.log("Reported Questions: " + reportedQuestionString);
        
        openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: generateChatPrompt(topic, difficulty, count, reportedQuestionString),
        }).then((completion) => {
            console.log(completion.data.choices[0].message.content);
            let questions = parseQuestions(completion.data.choices[0].message.content);
            console.log(questions);
            return res.json(questions);
        }).catch((error) => {
            console.error(error);
        });
    })
});
