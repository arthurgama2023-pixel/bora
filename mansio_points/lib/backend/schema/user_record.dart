import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class UserRecord extends FirestoreRecord {
  UserRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "email" field.
  String? _email;
  String get email => _email ?? '';
  bool hasEmail() => _email != null;

  // "display_name" field.
  String? _displayName;
  String get displayName => _displayName ?? '';
  bool hasDisplayName() => _displayName != null;

  // "photo_url" field.
  String? _photoUrl;
  String get photoUrl => _photoUrl ?? '';
  bool hasPhotoUrl() => _photoUrl != null;

  // "uid" field.
  String? _uid;
  String get uid => _uid ?? '';
  bool hasUid() => _uid != null;

  // "created_time" field.
  DateTime? _createdTime;
  DateTime? get createdTime => _createdTime;
  bool hasCreatedTime() => _createdTime != null;

  // "phone_number" field.
  String? _phoneNumber;
  String get phoneNumber => _phoneNumber ?? '';
  bool hasPhoneNumber() => _phoneNumber != null;

  // "CPF" field.
  String? _cpf;
  String get cpf => _cpf ?? '';
  bool hasCpf() => _cpf != null;

  // "pontos" field.
  int? _pontos;
  int get pontos => _pontos ?? 0;
  bool hasPontos() => _pontos != null;

  // "Endereco" field.
  String? _endereco;
  String get endereco => _endereco ?? '';
  bool hasEndereco() => _endereco != null;

  // "bairro" field.
  String? _bairro;
  String get bairro => _bairro ?? '';
  bool hasBairro() => _bairro != null;

  // "cidade" field.
  String? _cidade;
  String get cidade => _cidade ?? '';
  bool hasCidade() => _cidade != null;

  // "estado" field.
  String? _estado;
  String get estado => _estado ?? '';
  bool hasEstado() => _estado != null;

  // "cupom" field.
  List<DocumentReference>? _cupom;
  List<DocumentReference> get cupom => _cupom ?? const [];
  bool hasCupom() => _cupom != null;

  // "parceiro" field.
  List<DocumentReference>? _parceiro;
  List<DocumentReference> get parceiro => _parceiro ?? const [];
  bool hasParceiro() => _parceiro != null;

  // "proprietario" field.
  DocumentReference? _proprietario;
  DocumentReference? get proprietario => _proprietario;
  bool hasProprietario() => _proprietario != null;

  // "assinatura" field.
  String? _assinatura;
  String get assinatura => _assinatura ?? '';
  bool hasAssinatura() => _assinatura != null;

  // "data_assinatura" field.
  DateTime? _dataAssinatura;
  DateTime? get dataAssinatura => _dataAssinatura;
  bool hasDataAssinatura() => _dataAssinatura != null;

  // "assinate" field.
  bool? _assinate;
  bool get assinate => _assinate ?? false;
  bool hasAssinate() => _assinate != null;

  // "tipo_assinatura" field.
  int? _tipoAssinatura;
  int get tipoAssinatura => _tipoAssinatura ?? 0;
  bool hasTipoAssinatura() => _tipoAssinatura != null;

  // "data_assin" field.
  DateTime? _dataAssin;
  DateTime? get dataAssin => _dataAssin;
  bool hasDataAssin() => _dataAssin != null;

  // "is_adm" field.
  bool? _isAdm;
  bool get isAdm => _isAdm ?? false;
  bool hasIsAdm() => _isAdm != null;

  void _initializeFields() {
    _email = snapshotData['email'] as String?;
    _displayName = snapshotData['display_name'] as String?;
    _photoUrl = snapshotData['photo_url'] as String?;
    _uid = snapshotData['uid'] as String?;
    _createdTime = snapshotData['created_time'] as DateTime?;
    _phoneNumber = snapshotData['phone_number'] as String?;
    _cpf = snapshotData['CPF'] as String?;
    _pontos = castToType<int>(snapshotData['pontos']);
    _endereco = snapshotData['Endereco'] as String?;
    _bairro = snapshotData['bairro'] as String?;
    _cidade = snapshotData['cidade'] as String?;
    _estado = snapshotData['estado'] as String?;
    _cupom = getDataList(snapshotData['cupom']);
    _parceiro = getDataList(snapshotData['parceiro']);
    _proprietario = snapshotData['proprietario'] as DocumentReference?;
    _assinatura = snapshotData['assinatura'] as String?;
    _dataAssinatura = snapshotData['data_assinatura'] as DateTime?;
    _assinate = snapshotData['assinate'] as bool?;
    _tipoAssinatura = castToType<int>(snapshotData['tipo_assinatura']);
    _dataAssin = snapshotData['data_assin'] as DateTime?;
    _isAdm = snapshotData['is_adm'] as bool?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('user');

  static Stream<UserRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => UserRecord.fromSnapshot(s));

  static Future<UserRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => UserRecord.fromSnapshot(s));

  static UserRecord fromSnapshot(DocumentSnapshot snapshot) => UserRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static UserRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      UserRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'UserRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is UserRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createUserRecordData({
  String? email,
  String? displayName,
  String? photoUrl,
  String? uid,
  DateTime? createdTime,
  String? phoneNumber,
  String? cpf,
  int? pontos,
  String? endereco,
  String? bairro,
  String? cidade,
  String? estado,
  DocumentReference? proprietario,
  String? assinatura,
  DateTime? dataAssinatura,
  bool? assinate,
  int? tipoAssinatura,
  DateTime? dataAssin,
  bool? isAdm,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'email': email,
      'display_name': displayName,
      'photo_url': photoUrl,
      'uid': uid,
      'created_time': createdTime,
      'phone_number': phoneNumber,
      'CPF': cpf,
      'pontos': pontos,
      'Endereco': endereco,
      'bairro': bairro,
      'cidade': cidade,
      'estado': estado,
      'proprietario': proprietario,
      'assinatura': assinatura,
      'data_assinatura': dataAssinatura,
      'assinate': assinate,
      'tipo_assinatura': tipoAssinatura,
      'data_assin': dataAssin,
      'is_adm': isAdm,
    }.withoutNulls,
  );

  return firestoreData;
}

class UserRecordDocumentEquality implements Equality<UserRecord> {
  const UserRecordDocumentEquality();

  @override
  bool equals(UserRecord? e1, UserRecord? e2) {
    const listEquality = ListEquality();
    return e1?.email == e2?.email &&
        e1?.displayName == e2?.displayName &&
        e1?.photoUrl == e2?.photoUrl &&
        e1?.uid == e2?.uid &&
        e1?.createdTime == e2?.createdTime &&
        e1?.phoneNumber == e2?.phoneNumber &&
        e1?.cpf == e2?.cpf &&
        e1?.pontos == e2?.pontos &&
        e1?.endereco == e2?.endereco &&
        e1?.bairro == e2?.bairro &&
        e1?.cidade == e2?.cidade &&
        e1?.estado == e2?.estado &&
        listEquality.equals(e1?.cupom, e2?.cupom) &&
        listEquality.equals(e1?.parceiro, e2?.parceiro) &&
        e1?.proprietario == e2?.proprietario &&
        e1?.assinatura == e2?.assinatura &&
        e1?.dataAssinatura == e2?.dataAssinatura &&
        e1?.assinate == e2?.assinate &&
        e1?.tipoAssinatura == e2?.tipoAssinatura &&
        e1?.dataAssin == e2?.dataAssin &&
        e1?.isAdm == e2?.isAdm;
  }

  @override
  int hash(UserRecord? e) => const ListEquality().hash([
        e?.email,
        e?.displayName,
        e?.photoUrl,
        e?.uid,
        e?.createdTime,
        e?.phoneNumber,
        e?.cpf,
        e?.pontos,
        e?.endereco,
        e?.bairro,
        e?.cidade,
        e?.estado,
        e?.cupom,
        e?.parceiro,
        e?.proprietario,
        e?.assinatura,
        e?.dataAssinatura,
        e?.assinate,
        e?.tipoAssinatura,
        e?.dataAssin,
        e?.isAdm
      ]);

  @override
  bool isValidKey(Object? o) => o is UserRecord;
}
