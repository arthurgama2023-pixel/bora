import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class AssinaturasRecord extends FirestoreRecord {
  AssinaturasRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "titulo" field.
  String? _titulo;
  String get titulo => _titulo ?? '';
  bool hasTitulo() => _titulo != null;

  // "valor" field.
  double? _valor;
  double get valor => _valor ?? 0.0;
  bool hasValor() => _valor != null;

  // "status" field.
  String? _status;
  String get status => _status ?? '';
  bool hasStatus() => _status != null;

  // "data" field.
  DateTime? _data;
  DateTime? get data => _data;
  bool hasData() => _data != null;

  // "usuario" field.
  DocumentReference? _usuario;
  DocumentReference? get usuario => _usuario;
  bool hasUsuario() => _usuario != null;

  // "qrCode" field.
  String? _qrCode;
  String get qrCode => _qrCode ?? '';
  bool hasQrCode() => _qrCode != null;

  // "idPagamento" field.
  String? _idPagamento;
  String get idPagamento => _idPagamento ?? '';
  bool hasIdPagamento() => _idPagamento != null;

  void _initializeFields() {
    _titulo = snapshotData['titulo'] as String?;
    _valor = castToType<double>(snapshotData['valor']);
    _status = snapshotData['status'] as String?;
    _data = snapshotData['data'] as DateTime?;
    _usuario = snapshotData['usuario'] as DocumentReference?;
    _qrCode = snapshotData['qrCode'] as String?;
    _idPagamento = snapshotData['idPagamento'] as String?;
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('assinaturas');

  static Stream<AssinaturasRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => AssinaturasRecord.fromSnapshot(s));

  static Future<AssinaturasRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => AssinaturasRecord.fromSnapshot(s));

  static AssinaturasRecord fromSnapshot(DocumentSnapshot snapshot) =>
      AssinaturasRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static AssinaturasRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      AssinaturasRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'AssinaturasRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is AssinaturasRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createAssinaturasRecordData({
  String? titulo,
  double? valor,
  String? status,
  DateTime? data,
  DocumentReference? usuario,
  String? qrCode,
  String? idPagamento,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'titulo': titulo,
      'valor': valor,
      'status': status,
      'data': data,
      'usuario': usuario,
      'qrCode': qrCode,
      'idPagamento': idPagamento,
    }.withoutNulls,
  );

  return firestoreData;
}

class AssinaturasRecordDocumentEquality implements Equality<AssinaturasRecord> {
  const AssinaturasRecordDocumentEquality();

  @override
  bool equals(AssinaturasRecord? e1, AssinaturasRecord? e2) {
    return e1?.titulo == e2?.titulo &&
        e1?.valor == e2?.valor &&
        e1?.status == e2?.status &&
        e1?.data == e2?.data &&
        e1?.usuario == e2?.usuario &&
        e1?.qrCode == e2?.qrCode &&
        e1?.idPagamento == e2?.idPagamento;
  }

  @override
  int hash(AssinaturasRecord? e) => const ListEquality().hash([
        e?.titulo,
        e?.valor,
        e?.status,
        e?.data,
        e?.usuario,
        e?.qrCode,
        e?.idPagamento
      ]);

  @override
  bool isValidKey(Object? o) => o is AssinaturasRecord;
}
