const functions = require("firebase-functions");
const request = require("request-promise");
const config = require("./config.json");

//[1]เพิ่ม dialogflow-fulfillment library
//[7] เพิ่ม Payload
const { WebhookClient, Payload } = require("dialogflow-fulfillment");
const LINE_MESSAGING_API = "https://api.line.me/v2/bot/message";
const CHANEL_TOKEN = "qh1iUjdXCfmMGxo4JFxYzgK89CCXSu/Xyyr1LWkRovvrSo5xn4wC/1MF4uvdEwJ/61Qu7P+l58F/8PjfsimW12Y56/UjtVuRaLLBkDrUlpFP0F7kx3aqpOIoIK4m2kJvoSXHahGWzB+BZdHH8J7K0QdB04t89/1O/w1cDnyilFU="
const LINE_HEADER = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${CHANEL_TOKEN}`};

//[8] เพิ่ม firebase-admin และ initial database
const firebase = require("firebase-admin");
firebase.initializeApp({
  credential: firebase.credential.applicationDefault(),
  databaseURL: config.databaseURL
});
var db = firebase.firestore();

//ตั้งค่า region และปรับ timeout และเพิ่ม memory
const region = "asia-east2";
const runtimeOptions = {
  timeoutSeconds: 4,
  memory: "2GB"
};

//ทำ webhook request url
exports.webhook = functions
  .region(region)
  .runWith(runtimeOptions)
  .https.onRequest(async (req, res) => {
    console.log("LINE REQUEST BODY", JSON.stringify(req.body));

    //[2] ประกาศ ตัวแปร agent
    const agent = new WebhookClient({ request: req, response: res });

    //[4] ทำ function view menu เพื่อแสดงผลบางอย่างกลับไปที่หน้าจอของ bot
    const viewMenu = async agent => {
      //[5] เพิ่ม flex message
      //[9] แก้ไข flex message ให้ dynamic ได้
      const flexMenuMsg = {
        type: "flex",
        altText: "Flex Message",
        contents: {
          type: "bubble",
          header: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "ท่านต้องการที่จะ"
              }
            ]
          },
          hero: {
            type: "image",
            url:
              "https://sv1.picz.in.th/images/2021/02/05/o43QGl.jpg",
            size: "full",
            aspectRatio: "20:13",
            aspectMode: "cover"
          },
          body: {
            type: "box",
            layout: "vertical",
            spacing: "md",
            action: {
              type: "uri",
              label: "Action",
              uri: "https://linecorp.com"
            },
            contents: [
              {
                type: "text",
                text: "Pick AT Home",
                size: "xl",
                weight: "bold"
              },
              {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                 
                ]
              }
            ]
          }
        }
      };

      //[6] ปรับการตอบกลับ ให้ตอบกลับผ่าน flex message ด้วย Payload
      //[10] ปรับให้ต่อ database ได้ ตอบกลับผ่าน flex message ด้วย Payload
      return db
      .collection("Menu")
      .get()
      .then(snapshot => {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          let itemData = {
            type: "box",
            layout: "baseline",
            contents: [
              {
                type: "text",
                text: data.name,
                margin: "sm",
                weight: "bold",
                action: {
                  type: "message",
                  label: data.name,
                  text: data.name
                }
              },
          
            ]
          };
          flexMenuMsg.contents.body.contents[1].contents.push(itemData);
        });

        const payloadMsg = new Payload("LINE", flexMenuMsg, {
          sendAsMessage: true
        });
        return agent.add(payloadMsg);
      })
      .catch(error => {
        return response.status(500).send({
          error: error
        });
      });
    };   

    const viewMenuSelect = async agent => {
      //[13] ดึงข้อมูล source และ userId ขึ้นมาไว้
      let source = req.body.originalDetectIntentRequest.source;
      if (typeof source === "undefined") {
        source = "";
      }

      //ดึงข้อมูล userId
      let userId = "";
      if (source === "line") {
        userId =
          req.body.originalDetectIntentRequest.payload.data.source.userId;
      }

      //ดึงข้อมูลจาก parameters ขึ้นมาแสดง
      const unit = req.body.queryResult.parameters.unit;
      const total = req.body.queryResult.parameters.total;
      const parcel = req.body.queryResult.parameters.parcel;
     
      //[14] ดึง orderNo จาก database ขึ้นมาแสดง
      let orderNo = await db
        .collection("Order")
        .get()
        .then(snapshot => {
          return snapshot.size;
        });

      orderNo++;
      const orderNoStr = orderNo.toString().padStart(4, "0");
      const currentDate = Date.now();
      console.log(orderNoStr)
      
      // check user id in Users collection
      var status = -1
      const orderDB = null
      db.collection("Users").get().then((querySnapshot) => {
        querySnapshot.forEach((doc) => {
            // doc.data() is never undefined for query doc snapshots
            console.log(doc.id, " => ", doc.data());
            if(doc.id == userId){
              status = 1
              orderDB = doc.data()
            }else{
              console.log("nooooooooooooooooooooo")
              status = 0
            }
        });
      });
      
      console.log(status)
      // add user id in User collection
      // if(status == 0){
      //   db.collection("Users").doc(userId).set({
      //     orderNo: [orderNoStr]
      //   })
      // }else if(status == 1){
      //     console.log(orderDB)
      // }




      db.collection("Users").get()
      //[15] บันทึกข้อมูลลง database
      return db
      .collection("Order")
      .doc(orderNoStr)
      .set({
        timestamp: currentDate,
        unit : unit,
        total : total,
        parcel: parcel,
        userId: userId,
        source: source,
        orderNo: orderNo,
        status: 0,
        })
      .then(snapshot => {
        //[16] เพิ่ม flex เพื่อความสวยงาม
        let flexOrderMsg = {
          "type": "flex",
          "altText": "Flex Message",
          "contents": {
            "type": "bubble",
            "direction": "ltr",
            "body": {
              "type": "box",
              "layout": "vertical",
              "contents": [
                {
                  "type": "text",
                  "text": "Order Number",
                  "align": "center",
                  "weight": "bold"
                },
                {
                  "type": "text",
                  "text": `${orderNoStr}`,
                  "size": "3xl",
                  "align": "center",
                  "weight": "bold"
                },
                {
                  "type": "text",
                  "text": "รายการ",
                  "size": "lg",
                  "weight": "bold"
                },
                {
                  "type": "box",
                  "layout": "horizontal",
                  "contents": [
                    {
                      "type": "text",
                      "text": `${parcel} ${total} ชิ้น`,
                      "size": "md",
                      "weight": "regular"
                    },
                    
                  ]
                }
              ]
            },
            "footer": {
              "type": "box",
              "layout": "horizontal",
              "contents": [
                {
                  "type": "text",
                  "text":
                  "Pick AT Home ขอขอบคุณที่ท่านไว้ใจใช้บริการกับเรา",
                  "size": "md",
                  "align": "center",
                  "gravity": "center",
                  "weight": "regular",
                  "wrap": true
                }
              ]
            }
          }
        }
        
        const payloadMsg = new Payload("LINE", flexOrderMsg, {
          sendAsMessage: true
        });
        // ส่ง notify หาผู้ใช้งาน
        const notifyMsg = `มี Order No:${orderNoStr}\n ${parcel} ${total} ${unit}` 
        lineNotify(notifyMsg);
        return agent.add(payloadMsg);
      })
       .catch(error => {
        return agent.add(JSON.stringify(error));
      });
    };
    //ข้อมูลที่อยากเก็บไว้ส่งของ
    
    //[3] ทำ intent map เข้ากับ function
    let intentMap = new Map();
    intentMap.set("view-menu", viewMenu);
    
    intentMap.set("view-menu-select - yes", viewMenuSelect);

    agent.handleRequest(intentMap);
  });

  exports.dbMonitor = functions
  .region(region)
  .runWith(runtimeOptions)
  .firestore.document("Order/{Id}")
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();
    //ส่ง flex message เพื่อเรียกลูกค้ามารับกาแฟ
    if (previousValue.status === 0 && newValue.status === 1) {
      const orderNoStr = newValue.orderNo.toString().padStart(4, "0");
      let flexLineOrderMsg = {
        type: "flex",
        altText: "Flex Message",
        contents: {
          type: "bubble",
          direction: "ltr",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "Order Number",
                align: "center",
                weight: "bold"
              },
              {
                type: "text",
                text: `${orderNoStr}`,
                size: "3xl",
                align: "center",
                weight: "bold"
              },
              {
                type: "text",
                text: "รายการ",
                size: "lg",
                weight: "bold"
              }
            ]
          },
          footer: {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: `พัสดุของท่านได้ถูกจัดส่งเรียบร้อยแล้ว \n สามารถติดตามมเลขพัสดุของท่านได้ที่ \n https://web.facebook.com/Pickathomee \n ขอบคุณที่ใช้บริการ Pick AT Home ค่ะ`,
                size: "md",
                align: "center",
                gravity: "center",
                weight: "regular",
                wrap: true
              }
            ]
          }
        }
      };
      
      flexLineOrderMsg.contents.body.contents.push({
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: `${newValue.parcel} ${newValue.unit}`,
            size: "md",
            weight: "regular"
          },
          {
            type: "text",
            text: `${newValue.total} ชิ้น`,
            size: "md",
            align: "end",
            weight: "regular"
          }
        ]
      });
      return linePush(newValue.userId, [flexLineOrderMsg]);
    }
    return null;
  });
//ฝ้าย
const dialogflowWebHook = "https://dialogflow.cloud.google.com/v1/integrations/line/webhook/618249bd-9c0a-4dff-a221-0a97f0c73ecc";

exports.LineAdapter = functions
.region(region)
.runWith(runtimeOptions)
.https.onRequest(async (req, res) => {
  if (req.method === "POST") {
    const event = req.body.events[0];
    let userId = "";
    userId = req.body.events[0].source.userId
    console.log("req queryResult: ",req.body)
    console.log("event: ", event);
    if (event.type === "message" && event.message.type === "text") {
      postToDialogflow(req);
    } else {
      reply(req,userId);
    }
  }
  return res.status(200).send(req.method);
});
//


const updateTodb = (address,lat,lng,userId) =>{
  // get user on firebase database
  db.collection("Order").get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
        // doc.data() is never undefined for query doc snapshots
        console.log(doc.id, " => ", doc.data());

    });
});

//   db.collection("Order")
//   .doc()
//   .set({
//     address: address,
//     latitude: lat,
//     longitude: lng
    
//   })
//   .then(console.log("update success!"))
}

const reply = (req,userId) => { 
  //ดึงข้อมูล userId
  db.collection("Users").doc(userId).get().then(snapshot =>{
    console.log(snapshot.data())
  })
  console.log("from reply",userId)
  // if(req.body.events[0].message.type == "location"){
  //   console.log(req.body.events[0].message.address)
  //   const address = req.body.events[0].message.address
  //   const lat = req.body.events[0].message.latitude
  //   const lng = req.body.events[0].message.longitude
  //   updateTodb(address,lat,lng,userId)
  // }
  return request.post({
    uri: `${LINE_MESSAGING_API}/reply`,
    headers: LINE_HEADER,
    body: JSON.stringify({
      replyToken: req.body.events[0].replyToken,
      messages: [
        {
          type: "text",
          text : "ระบุวันเข้ารับ",
          "quickReply": {
            "items": [
              {
                "type": "action",
                "imageUrl": "https://icla.org/wp-content/uploads/2018/02/blue-calendar-icon.png",
                "action": {
                  "type": "datetimepicker",
                  "label": "Datetime Picker",
                  "data": "storeId=12345",
                  "mode": "datetime",
                  "initial": "2018-08-10t00:00",
                  "max": "2021-12-31t23:59",
                  "min": "2018-08-01t00:00"
                }
              }
            ]
          }
          // text: JSON.stringify(req.body),
        },
      ],
    }),
  });
};


const postToDialogflow = (req) => {
  req.headers.host = "dialogflow.cloud.google.com";
  console.log("textjaaa");
  return request.post({
    uri: dialogflowWebHook,
    headers: req.headers,
    body: JSON.stringify(req.body),
  });
};



//function สำหรับ reply กลับไปหา LINE โดยต้องการ reply token และ messages (array)
const lineReply = (replyToken, messages) => {
  const body = {
    replyToken: replyToken,
    messages: messages
  };
  return request({
    method: "POST",
    uri: `${config.lineMessagingApi}/reply`,
    headers: config.lineHeaders,
    body: JSON.stringify(body)
  });
};
const lineNotify = msg => {
  return request({
    method: "POST",
    uri: "https://notify-api.line.me/api/notify",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Bearer " + config.notifyToken
    },
    form: {
      message: msg
    }
  });
};
//function สำหรับ push ข้อความไปหาผู้ใช้งาน
const linePush = (to, messages) => {
  var body = {
    to: to,
    messages: messages
  };
  return request({
    method: "POST",
    uri: `${config.lineMessagingApi}/push`,
    headers: config.lineHeaders,
    body: JSON.stringify(body)
  });
};