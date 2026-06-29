import 'dart:async';

import 'package:collection/collection.dart';

import '/backend/schema/util/firestore_util.dart';
import '/backend/schema/util/schema_util.dart';

import 'index.dart';
import '/flutter_flow/flutter_flow_util.dart';

class ParceirosRecord extends FirestoreRecord {
  ParceirosRecord._(
    DocumentReference reference,
    Map<String, dynamic> data,
  ) : super(reference, data) {
    _initializeFields();
  }

  // "idParceiros" field.
  String? _idParceiros;
  String get idParceiros => _idParceiros ?? '';
  bool hasIdParceiros() => _idParceiros != null;

  // "nome" field.
  String? _nome;
  String get nome => _nome ?? '';
  bool hasNome() => _nome != null;

  // "capa" field.
  String? _capa;
  String get capa => _capa ?? '';
  bool hasCapa() => _capa != null;

  // "desconto" field.
  double? _desconto;
  double get desconto => _desconto ?? 0.0;
  bool hasDesconto() => _desconto != null;

  // "descricao" field.
  String? _descricao;
  String get descricao => _descricao ?? '';
  bool hasDescricao() => _descricao != null;

  // "categoria" field.
  String? _categoria;
  String get categoria => _categoria ?? '';
  bool hasCategoria() => _categoria != null;

  // "avaliacao" field.
  double? _avaliacao;
  double get avaliacao => _avaliacao ?? 0.0;
  bool hasAvaliacao() => _avaliacao != null;

  // "local" field.
  LatLng? _local;
  LatLng? get local => _local;
  bool hasLocal() => _local != null;

  // "cidade" field.
  String? _cidade;
  String get cidade => _cidade ?? '';
  bool hasCidade() => _cidade != null;

  // "estado" field.
  String? _estado;
  String get estado => _estado ?? '';
  bool hasEstado() => _estado != null;

  // "pontos" field.
  int? _pontos;
  int get pontos => _pontos ?? 0;
  bool hasPontos() => _pontos != null;

  // "pagina" field.
  String? _pagina;
  String get pagina => _pagina ?? '';
  bool hasPagina() => _pagina != null;

  // "ativo" field.
  bool? _ativo;
  bool get ativo => _ativo ?? false;
  bool hasAtivo() => _ativo != null;

  // "dono" field.
  DocumentReference? _dono;
  DocumentReference? get dono => _dono;
  bool hasDono() => _dono != null;

  // "telefone" field.
  String? _telefone;
  String get telefone => _telefone ?? '';
  bool hasTelefone() => _telefone != null;

  // "email" field.
  String? _email;
  String get email => _email ?? '';
  bool hasEmail() => _email != null;

  // "whatsapp" field.
  String? _whatsapp;
  String get whatsapp => _whatsapp ?? '';
  bool hasWhatsapp() => _whatsapp != null;

  // "cep" field.
  String? _cep;
  String get cep => _cep ?? '';
  bool hasCep() => _cep != null;

  // "numero" field.
  int? _numero;
  int get numero => _numero ?? 0;
  bool hasNumero() => _numero != null;

  void _initializeFields() {
    _idParceiros = snapshotData['idParceiros'] as String?;
    _nome = snapshotData['nome'] as String?;
    _capa = snapshotData['capa'] as String?;
    _desconto = castToType<double>(snapshotData['desconto']);
    _descricao = snapshotData['descricao'] as String?;
    _categoria = snapshotData['categoria'] as String?;
    _avaliacao = castToType<double>(snapshotData['avaliacao']);
    _local = snapshotData['local'] as LatLng?;
    _cidade = snapshotData['cidade'] as String?;
    _estado = snapshotData['estado'] as String?;
    _pontos = castToType<int>(snapshotData['pontos']);
    _pagina = snapshotData['pagina'] as String?;
    _ativo = snapshotData['ativo'] as bool?;
    _dono = snapshotData['dono'] as DocumentReference?;
    _telefone = snapshotData['telefone'] as String?;
    _email = snapshotData['email'] as String?;
    _whatsapp = snapshotData['whatsapp'] as String?;
    _cep = snapshotData['cep'] as String?;
    _numero = castToType<int>(snapshotData['numero']);
  }

  static CollectionReference get collection =>
      FirebaseFirestore.instance.collection('parceiros');

  static Stream<ParceirosRecord> getDocument(DocumentReference ref) =>
      ref.snapshots().map((s) => ParceirosRecord.fromSnapshot(s));

  static Future<ParceirosRecord> getDocumentOnce(DocumentReference ref) =>
      ref.get().then((s) => ParceirosRecord.fromSnapshot(s));

  static ParceirosRecord fromSnapshot(DocumentSnapshot snapshot) =>
      ParceirosRecord._(
        snapshot.reference,
        mapFromFirestore(snapshot.data() as Map<String, dynamic>),
      );

  static ParceirosRecord getDocumentFromData(
    Map<String, dynamic> data,
    DocumentReference reference,
  ) =>
      ParceirosRecord._(reference, mapFromFirestore(data));

  @override
  String toString() =>
      'ParceirosRecord(reference: ${reference.path}, data: $snapshotData)';

  @override
  int get hashCode => reference.path.hashCode;

  @override
  bool operator ==(other) =>
      other is ParceirosRecord &&
      reference.path.hashCode == other.reference.path.hashCode;
}

Map<String, dynamic> createParceirosRecordData({
  String? idParceiros,
  String? nome,
  String? capa,
  double? desconto,
  String? descricao,
  String? categoria,
  double? avaliacao,
  LatLng? local,
  String? cidade,
  String? estado,
  int? pontos,
  String? pagina,
  bool? ativo,
  DocumentReference? dono,
  String? telefone,
  String? email,
  String? whatsapp,
  String? cep,
  int? numero,
}) {
  final firestoreData = mapToFirestore(
    <String, dynamic>{
      'idParceiros': idParceiros,
      'nome': nome,
      'capa': capa,
      'desconto': desconto,
      'descricao': descricao,
      'categoria': categoria,
      'avaliacao': avaliacao,
      'local': local,
      'cidade': cidade,
      'estado': estado,
      'pontos': pontos,
      'pagina': pagina,
      'ativo': ativo,
      'dono': dono,
      'telefone': telefone,
      'email': email,
      'whatsapp': whatsapp,
      'cep': cep,
      'numero': numero,
    }.withoutNulls,
  );

  return firestoreData;
}

class ParceirosRecordDocumentEquality implements Equality<ParceirosRecord> {
  const ParceirosRecordDocumentEquality();

  @override
  bool equals(ParceirosRecord? e1, ParceirosRecord? e2) {
    return e1?.idParceiros == e2?.idParceiros &&
        e1?.nome == e2?.nome &&
        e1?.capa == e2?.capa &&
        e1?.desconto == e2?.desconto &&
        e1?.descricao == e2?.descricao &&
        e1?.categoria == e2?.categoria &&
        e1?.avaliacao == e2?.avaliacao &&
        e1?.local == e2?.local &&
        e1?.cidade == e2?.cidade &&
        e1?.estado == e2?.estado &&
        e1?.pontos == e2?.pontos &&
        e1?.pagina == e2?.pagina &&
        e1?.ativo == e2?.ativo &&
        e1?.dono == e2?.dono &&
        e1?.telefone == e2?.telefone &&
        e1?.email == e2?.email &&
        e1?.whatsapp == e2?.whatsapp &&
        e1?.cep == e2?.cep &&
        e1?.numero == e2?.numero;
  }

  @override
  int hash(ParceirosRecord? e) => const ListEquality().hash([
        e?.idParceiros,
        e?.nome,
        e?.capa,
        e?.desconto,
        e?.descricao,
        e?.categoria,
        e?.avaliacao,
        e?.local,
        e?.cidade,
        e?.estado,
        e?.pontos,
        e?.pagina,
        e?.ativo,
        e?.dono,
        e?.telefone,
        e?.email,
        e?.whatsapp,
        e?.cep,
        e?.numero
      ]);

  @override
  bool isValidKey(Object? o) => o is ParceirosRecord;
}
