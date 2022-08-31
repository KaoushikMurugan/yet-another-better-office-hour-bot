import { BaseServerExtension } from "./extension-interface";
import { Firestore } from "firebase-admin/firestore";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { TutorInfoSheet } from "./firebase-models/tutor_info";
import { MsgAfterLeaveVCDoc } from './firebase-models/msg_after_leave_vc';
import firebase_creds from "../../fbs_service_account_key.json";


class FirebaseLoggingExtension extends BaseServerExtension {

    private readonly firebase_db: Firestore;

    constructor(serverName: string) {
        super();
        this.firebase_db = getFirestore(initializeApp({
            credential: cert(firebase_creds)
        }));
        console.log(
            `[\x1b[34mFirebase Logging Extension\x1b[0m] successfully loaded for '${serverName}'!\n`
        );
    }

    


}