const axios = require("axios");

exports.uploadToPlatform = async (req) => {
  // const authToken = req.token;
  const qb_id = req.qb_id; // Question Bank ID
  const topic_id = req.topic_id; // Topic ID
  const sub_topic_id = req.sub_topic_id; // Sub-topic ID
  const subject_id = req.subject_id; // Subject ID
  const createdBy = req.createdBy; // User ID

  const questions = req.response; // Array of MCQs

  // const baseData = {
  //   question_type: "mcq_single_correct",
  //   subject_id: subject_id,
  //   topic_id: topic_id,
  //   sub_topic_id: sub_topic_id,
  //   blooms_taxonomy: null,
  //   course_outcome: null,
  //   program_outcome: null,
  //   hint: [],
  //   answer_explanation: {
  //     args: []
  //   },
  //   linked_concepts: "",
  //   tags: [],
  //   question_media: [],
  //   qb_id: qb_id ? qb_id : "4cd4d5ec-5940-4b41-ac48-6b6c6fce324c",
  //   createdBy: createdBy ? createdBy : "bd3c2f4d-b53d-4de6-82c9-00413b70756c"
  // };

  const results = [];

  // for (const q of questions) {
//     const requestBody = {
//       ...baseData,
//       question_data: q.question_data,
//       options: q.options.map(opt => ({ text: opt.text, media: "" })), // Add media key if missing
//       answer: q.answer,
//  // it should be first letter capital for manual_difficulty
//         manual_difficulty: q.manual_difficulty.charAt(0).toUpperCase() + q.manual_difficulty.slice(1),
//         // if question_data contains $$$examly then add question_editor_type 3
//         question_editor_type: q.question_data.includes("$$$examly") ? 3 : 1,
//     };

    // console.log(req.data);
    

    try {
      const response = await axios.post(
        "https://api.examly.io/api/programming_question/create",
        req.data,
        {
          headers: {
           "Cache-Control": "no-cache",
          "Postman-Token": "<calculated when request is sent>",
          "Content-Type": "application/json",
          // "Content-Length": "<calculated when request is sent>",
          "User-Agent": "PostmanRuntime/7.42.0",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Accept": "application/json, text/plain, */*",
          Authorization: req.token,
          }
        }
      );

      // console.log(`Uploaded: ${q.question_data}`);
      results.push({ question: req.data, status: "Uploaded" });

    } catch (error) {
      console.error(`Failed to upload:`, error.response?.data || error.message);
      results.push({ question: q.question_data, status: "Failed", error: error.message });
    }
  // }
  // console.log(results);
  

  return results;
};
